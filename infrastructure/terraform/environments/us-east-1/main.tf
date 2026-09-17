terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket       = "cht-reports-terraform-state"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
    # State key: pass via -backend-config=../backends/us-east-1-{production|dev}.hcl
  }
}

provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      Region      = "us-east-1"
      ManagedBy   = "Terraform"
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  env_short          = var.environment == "production" ? "prod" : var.environment
  resource_prefix    = "${var.project}-${local.env_short}"
  log_retention_days = contains(["prod", "production"], var.environment) ? 365 : 7
  ecr_repository_names = [
    "cht-reports-${local.env_short}-backend",
    "cht-reports-${local.env_short}-generator",
    "cht-reports-${local.env_short}-service",
  ]
}

# ============================================
# Security - KMS Keys
# ============================================
module "kms" {
  source = "../../modules/security/kms"

  project        = var.project
  environment    = var.environment
  aws_region     = "us-east-1"
  aws_account_id = data.aws_caller_identity.current.account_id
}

# ============================================
# Compute - ECR
# ============================================
module "ecr" {
  source = "../../modules/compute/ecr"

  repository_names = local.ecr_repository_names
  tags = {
    Environment = var.environment
    Project     = var.project
  }
}

module "ecr_lifecycle" {
  source = "../../modules/compute/ecr-lifecycle"

  repository_names = module.ecr.repository_names
}

# ============================================
# Storage - S3 reports
# ============================================
module "s3_reports" {
  source = "../../modules/storage/s3-reports"

  resource_prefix = local.resource_prefix
  environment     = var.environment
  kms_key_arn     = module.kms.s3_kms_key_arn
  force_destroy   = var.s3_force_destroy
}

# ============================================
# Messaging
# ============================================
module "sqs" {
  source = "../../modules/messaging/sqs"

  resource_prefix            = local.resource_prefix
  environment                = var.environment
  kms_key_arn                = module.kms.sqs_kms_key_arn
  visibility_timeout_seconds = var.lambda_timeout + 60
}

module "sns_alerts" {
  source = "../../modules/messaging/sns-alerts"

  resource_prefix           = local.resource_prefix
  environment               = var.environment
  kms_key_arn               = module.kms.sns_kms_key_arn
  alarm_notification_emails = var.alarm_notification_emails
}

# On-demand report requests, separate from the scheduled-batch "generate"
# queue above. CHT posts here when a user requests a report; the ECS
# service (not the Lambda) consumes it. Reuses the same sqs module, a
# distinct resource_prefix avoids colliding on the queue name.
module "sqs_report_requests" {
  source = "../../modules/messaging/sqs"

  resource_prefix            = "${local.resource_prefix}-requests"
  environment                = var.environment
  kms_key_arn                = module.kms.sqs_kms_key_arn
  visibility_timeout_seconds = var.report_request_visibility_timeout_seconds
}

# Fired by the ECS service once a report is generated and uploaded to S3,
# so CHT can notify whoever requested it. Separate from sns_alerts, which
# is ops/CloudWatch-alarm only.
module "sns_report_ready" {
  source = "../../modules/messaging/sns-alerts"

  resource_prefix           = "${local.resource_prefix}-report-ready"
  environment               = var.environment
  kms_key_arn               = module.kms.sns_kms_key_arn
  alarm_notification_emails = []
}

# ============================================
# Secrets
# ============================================
module "secrets" {
  source = "../../modules/security/secrets-manager"

  resource_prefix = local.resource_prefix
  environment     = var.environment
  kms_key_arn     = module.kms.secrets_kms_key_arn
  secret_values = {
    CONTENTHUB_API_KEY    = var.contenthub_api_key
    PLATFORM_TOOL_API_KEY = var.platform_tool_api_key
  }
}

# ============================================
# Lambdas (container images)
# ============================================
module "lambda" {
  source   = "../../modules/compute/lambda-container"
  for_each = var.lambda_images

  resource_prefix        = local.resource_prefix
  name                   = each.key
  environment            = var.environment
  image_uri              = each.value
  timeout                = var.lambda_timeout
  memory_size            = var.lambda_memory_size
  log_retention_days     = local.log_retention_days
  cloudwatch_kms_key_arn = module.kms.cloudwatch_kms_key_arn
  s3_bucket_arn          = module.s3_reports.bucket_arn
  sqs_queue_arn          = module.sqs.queue_arn
  secrets_arn            = module.secrets.secret_arn
  kms_key_arns = [
    module.kms.s3_kms_key_arn,
    module.kms.sqs_kms_key_arn,
    module.kms.secrets_kms_key_arn,
  ]
  environment_variables = {
    ENVIRONMENT         = var.environment
    REPORTS_BUCKET      = module.s3_reports.bucket_id
    SECRETS_ARN         = module.secrets.secret_arn
    CONTENTHUB_BASE_URL = var.contenthub_base_url
    GENERATE_QUEUE_URL  = module.sqs.queue_url
  }
}

# ============================================
# Event source: SQS → generator:live
# ============================================
resource "aws_lambda_event_source_mapping" "generate" {
  event_source_arn = module.sqs.queue_arn
  function_name    = module.lambda["generator"].live_alias_arn
  batch_size       = 1
  enabled          = true
}

# ============================================
# EventBridge schedule → generator:live
# ============================================
module "generate_schedule" {
  source = "../../modules/messaging/eventbridge-lambda"

  resource_prefix      = local.resource_prefix
  environment          = var.environment
  schedule_expression  = var.generate_schedule_expression
  lambda_alias_arn     = module.lambda["generator"].live_alias_arn
  lambda_function_name = module.lambda["generator"].function_name
  enabled              = var.enable_generate_schedule
}

# ============================================
# Monitoring
# ============================================
module "cloudwatch" {
  source = "../../modules/monitoring/cloudwatch"

  resource_prefix      = local.resource_prefix
  environment          = var.environment
  lambda_function_name = module.lambda["generator"].function_name
  sns_topic_arn        = module.sns_alerts.topic_arn
}

# ============================================
# Compute - ECS (on-demand orchestration service)
# ============================================
# Joins the shared cht-platform-tool cluster/namespace, does not run its
# own cluster or VPC. See modules/compute/ecs-cluster for why.

# cht-companion's shared BFF-auth secret (COMPANION_INTERNAL_SECRET). Not a
# managed resource here. It is created and rotated in cht-companion's own
# Terraform (modules/security/bff-auth); reports just needs read access to
# send the matching X-BFF-Auth header on calls to /generate. Same
# cross-repo-secret pattern as CPR-12's Cognito M2M design: reference via
# data source, IAM grant here, lifecycle owned by the other repo.
data "aws_secretsmanager_secret" "companion_bff_auth" {
  name = var.companion_bff_auth_secret_name
}

# cht-companion uses one shared KMS key for everything (not a per-service
# split like this repo's own kms module), with a root-account-wide grant.
# Same-account IAM policy on cht-reports' execution role is what actually
# gates access, no change needed on cht-companion's side.
data "aws_kms_alias" "companion" {
  name = var.companion_kms_alias
}

module "ecs_cluster" {
  source = "../../modules/compute/ecs-cluster"

  platform_cluster_name                = var.platform_cluster_name
  platform_vpc_name                    = var.platform_vpc_name
  platform_backend_security_group_name = var.platform_backend_security_group_name
  service_connect_namespace_name       = var.service_connect_namespace_name
}

# Per-request generation state and retry tracking (max 5 attempts).
# Separate from the reports.* Postgres schema on Content Hub's Aurora.
# This is orchestration bookkeeping, not report content.
module "dynamodb" {
  source = "../../modules/database/dynamodb"

  resource_prefix = local.resource_prefix
  environment     = var.environment
  kms_key_arn     = module.kms.dynamodb_kms_key_arn
}

module "iam" {
  source = "../../modules/security/iam"

  resource_prefix     = local.resource_prefix
  environment         = var.environment
  secrets_kms_key_arn = module.kms.secrets_kms_key_arn
  secret_arns         = ["${module.secrets.secret_arn}*"]
  s3_bucket_arn       = module.s3_reports.bucket_arn

  report_ready_topic_arn    = module.sns_report_ready.topic_arn
  report_requests_queue_arn = module.sqs_report_requests.queue_arn

  dynamodb_table_arn   = module.dynamodb.table_arn
  dynamodb_kms_key_arn = module.kms.dynamodb_kms_key_arn

  companion_bff_auth_secret_arn = data.aws_secretsmanager_secret.companion_bff_auth.arn
  companion_kms_key_arn         = data.aws_kms_alias.companion.target_key_arn
}

module "ecs_backend" {
  source = "../../modules/compute/ecs-backend"

  resource_prefix = local.resource_prefix
  environment     = var.environment
  image_uri       = var.reports_service_image_uri

  execution_role_arn = module.iam.execution_role_arn
  task_role_arn      = module.iam.task_role_arn

  cluster_id                         = module.ecs_cluster.cluster_id
  vpc_id                             = module.ecs_cluster.vpc_id
  private_subnet_ids                 = module.ecs_cluster.private_subnet_ids
  platform_backend_security_group_id = module.ecs_cluster.platform_backend_security_group_id
  service_connect_namespace_arn      = module.ecs_cluster.service_connect_namespace_arn

  environment_variables = {
    ENVIRONMENT               = var.environment
    REPORTS_BUCKET            = module.s3_reports.bucket_id
    PLATFORM_TOOL_BASE_URL    = var.platform_tool_base_url
    REPORT_REQUESTS_QUEUE_URL = module.sqs_report_requests.queue_url
    REPORT_READY_TOPIC_ARN    = module.sns_report_ready.topic_arn
    GENERATION_STATE_TABLE    = module.dynamodb.table_name
    MAX_GENERATION_ATTEMPTS   = "5"
  }

  secret_arns = {
    PLATFORM_TOOL_API_KEY = "${module.secrets.secret_arn}:PLATFORM_TOOL_API_KEY::"
    # Plain-string secret (not JSON), no :KEY:: suffix. Matches how
    # cht-companion's own ecs-companion module consumes this same secret.
    COMPANION_INTERNAL_SECRET = data.aws_secretsmanager_secret.companion_bff_auth.arn
  }
}
