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

  resource_prefix            = local.resource_prefix
  environment                = var.environment
  kms_key_arn                = module.kms.sns_kms_key_arn
  alarm_notification_emails  = var.alarm_notification_emails
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
    CONTENTHUB_API_KEY = var.contenthub_api_key
  }
}

# ============================================
# Lambdas (container images)
# ============================================
module "lambda" {
  source   = "../../modules/compute/lambda-container"
  for_each = var.lambda_images

  resource_prefix    = local.resource_prefix
  name               = each.key
  environment        = var.environment
  image_uri          = each.value
  timeout            = var.lambda_timeout
  memory_size        = var.lambda_memory_size
  log_retention_days = local.log_retention_days
  cloudwatch_kms_key_arn = module.kms.cloudwatch_kms_key_arn
  s3_bucket_arn      = module.s3_reports.bucket_arn
  sqs_queue_arn      = module.sqs.queue_arn
  secrets_arn        = module.secrets.secret_arn
  kms_key_arns = [
    module.kms.s3_kms_key_arn,
    module.kms.sqs_kms_key_arn,
    module.kms.secrets_kms_key_arn,
  ]
  environment_variables = {
    ENVIRONMENT          = var.environment
    REPORTS_BUCKET       = module.s3_reports.bucket_id
    SECRETS_ARN          = module.secrets.secret_arn
    CONTENTHUB_BASE_URL  = var.contenthub_base_url
    GENERATE_QUEUE_URL   = module.sqs.queue_url
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

  resource_prefix         = local.resource_prefix
  environment             = var.environment
  schedule_expression     = var.generate_schedule_expression
  lambda_alias_arn        = module.lambda["generator"].live_alias_arn
  lambda_function_name    = module.lambda["generator"].function_name
  enabled                 = var.enable_generate_schedule
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
