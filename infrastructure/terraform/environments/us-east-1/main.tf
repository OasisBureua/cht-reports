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

# Secondary region for the report job table's global replica (DR region).
provider "aws" {
  alias  = "us_east_2"
  region = "us-east-2"

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      Region      = "us-east-2"
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

  platform_tool_role_arns = var.platform_tool_role_arns
}

# ============================================
# Compute - ECR
# ============================================
module "ecr" {
  source = "../../modules/compute/ecr"

  repository_names = local.ecr_repository_names
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

  resource_prefix         = local.resource_prefix
  environment             = var.environment
  kms_key_arn             = module.kms.s3_kms_key_arn
  force_destroy           = var.s3_force_destroy
  platform_tool_role_arns = var.platform_tool_role_arns
}

# ============================================
# Messaging
# ============================================
module "sns_alerts" {
  source = "../../modules/messaging/sns-alerts"

  resource_prefix           = local.resource_prefix
  environment               = var.environment
  kms_key_arn               = module.kms.sns_kms_key_arn
  alarm_notification_emails = var.alarm_notification_emails
}

# On-demand report requests. cht-platform-tool's generate BFF posts
# { reportId } here; the ECS service consumes it.
module "sqs_report_requests" {
  source = "../../modules/messaging/sqs"

  name                       = "cht-${local.env_short}-report-requests"
  environment                = var.environment
  kms_key_arn                = module.kms.sqs_kms_key_arn
  visibility_timeout_seconds = var.report_request_visibility_timeout_seconds
}

# cht-platform-tool's generate BFF (CPR-30) enqueues { reportId } here.
resource "aws_sqs_queue_policy" "report_requests_platform_tool" {
  count = length(var.platform_tool_role_arns) > 0 ? 1 : 0

  queue_url = module.sqs_report_requests.queue_url
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PlatformToolSendReportRequests"
        Effect    = "Allow"
        Principal = { AWS = var.platform_tool_role_arns }
        Action    = ["sqs:SendMessage", "sqs:GetQueueUrl", "sqs:GetQueueAttributes"]
        Resource  = module.sqs_report_requests.queue_arn
      },
    ]
  })
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
# Compute - ECS (on-demand orchestration service)
# ============================================
# Joins the shared cht-platform-tool cluster/namespace, does not run its
# own cluster or VPC. See modules/compute/ecs-cluster for why.

# cht-reports M2M caller. Hub still owns the `hub` RS (hub/reports.read).
# Import the live client + secret; do not create a second one. Apply Hub
# `removed { destroy = false }` before the first reports apply that owns them.
locals {
  reports_m2m_secret_name = var.contenthub_m2m_secret_name != "" ? var.contenthub_m2m_secret_name : "cht-${local.env_short}-cognito-m2m-reports"
  reports_m2m_token_url   = var.cognito_auth_domain != "" ? "https://${trimsuffix(var.cognito_auth_domain, "/")}/oauth2/token" : ""
}

module "reports_m2m" {
  count  = var.cognito_user_pool_id != "" ? 1 : 0
  source = "../../modules/identity/reports-m2m"

  environment  = var.environment
  user_pool_id = var.cognito_user_pool_id
  token_url    = local.reports_m2m_token_url
  secret_name  = local.reports_m2m_secret_name

  hub_reports_scope        = "hub/reports.read"
  platform_notify_scope    = var.platform_reports_notify_scope
  companion_generate_scope = var.companion_generate_scope
}

locals {
  contenthub_m2m_secret_arn = try(module.reports_m2m[0].secret_arn, "")
  contenthub_m2m_task_secrets = local.contenthub_m2m_secret_arn == "" ? {} : {
    CONTENTHUB_M2M_CLIENT_ID     = "${local.contenthub_m2m_secret_arn}:client_id::"
    CONTENTHUB_M2M_CLIENT_SECRET = "${local.contenthub_m2m_secret_arn}:client_secret::"
    CONTENTHUB_M2M_TOKEN_URL     = "${local.contenthub_m2m_secret_arn}:token_url::"
    CONTENTHUB_M2M_SCOPE         = "${local.contenthub_m2m_secret_arn}:scope::"
  }
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
  table_name      = "cht-${local.env_short}-report-state"
  kms_key_arn     = module.kms.dynamodb_kms_key_arn

  replicas = [
    { region = "us-east-2", kms_key_arn = aws_kms_key.dynamodb_replica.arn },
  ]

  platform_tool_role_arns = var.platform_tool_role_arns
}

# The table's KMS key is single-region, so the us-east-2 replica gets its own
# key with the same policy shape (platform-tool only via DynamoDB).
resource "aws_kms_key" "dynamodb_replica" {
  provider = aws.us_east_2

  description             = "${local.resource_prefix} DynamoDB replica encryption key (us-east-2)"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat([
      {
        Sid       = "EnableRootAccountPermissions"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      },
      ], length(var.platform_tool_role_arns) == 0 ? [] : [{
        Sid       = "PlatformToolViaDynamoDB"
        Effect    = "Allow"
        Principal = { AWS = var.platform_tool_role_arns }
        Action    = ["kms:Encrypt", "kms:Decrypt", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:DescribeKey", "kms:CreateGrant"]
        Resource  = "*"
        Condition = { StringEquals = { "kms:ViaService" = "dynamodb.us-east-2.amazonaws.com" } }
    }])
  })

  tags = {
    Name        = "${local.resource_prefix}-dynamodb-replica-key"
    Environment = var.environment
    Service     = "dynamodb"
  }
}

resource "aws_kms_alias" "dynamodb_replica" {
  provider = aws.us_east_2

  name          = "alias/${local.resource_prefix}-dynamodb"
  target_key_id = aws_kms_key.dynamodb_replica.key_id
}

module "iam" {
  source = "../../modules/security/iam"

  resource_prefix     = local.resource_prefix
  environment         = var.environment
  secrets_kms_key_arn = module.kms.secrets_kms_key_arn
  secret_arns         = compact(["${module.secrets.secret_arn}*", local.contenthub_m2m_secret_arn])
  s3_bucket_arn       = module.s3_reports.bucket_arn
  s3_kms_key_arn      = module.kms.s3_kms_key_arn

  report_requests_queue_arn = module.sqs_report_requests.queue_arn
  sqs_kms_key_arn           = module.kms.sqs_kms_key_arn

  dynamodb_table_arn   = module.dynamodb.table_arn
  dynamodb_kms_key_arn = module.kms.dynamodb_kms_key_arn
}

module "ecs_backend" {
  source = "../../modules/compute/ecs-backend"

  resource_prefix = local.resource_prefix
  environment     = var.environment
  image_uri       = var.reports_service_image_uri

  log_retention_days = local.log_retention_days

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
    CONTENTHUB_BASE_URL       = var.contenthub_base_url
    REPORT_REQUESTS_QUEUE_URL = module.sqs_report_requests.queue_url
    GENERATION_STATE_TABLE    = module.dynamodb.table_name
    # Report-ready email (CPR-35): Platform sends it when told a version is
    # ready. Token comes from the same M2M client as Hub, different scope.
    PLATFORM_BASE_URL             = var.platform_api_base_url
    PLATFORM_REPORTS_NOTIFY_SCOPE = var.platform_reports_notify_scope
    MAX_GENERATION_ATTEMPTS       = "3"
  }

  secret_arns = merge(
    {
      # No longer read by the worker (Hub requires Bearer since
      # cht-content-hub #153). Removed in the long-lived secret cleanup.
      CONTENTHUB_API_KEY = "${module.secrets.secret_arn}:CONTENTHUB_API_KEY::"
    },
    local.contenthub_m2m_task_secrets,
  )
}

# ============================================
# Monitoring (CPR-53): alarms on the report worker
# ============================================
module "cloudwatch" {
  source = "../../modules/monitoring/cloudwatch"

  resource_prefix = local.resource_prefix
  environment     = var.environment
  sns_topic_arn   = module.sns_alerts.topic_arn

  log_group_name = module.ecs_backend.log_group_name
  cluster_name   = var.platform_cluster_name
  service_name   = module.ecs_backend.service_name
  dlq_name       = module.sqs_report_requests.dlq_name
}
