# CHT Reports: dev.github.tfvars
# Non-secret infra for GitHub Actions deploy-dev.yml (committed).
# Secrets: GitHub Environment "development" → TF_VAR_* (see .github/CI_CD.md).
# Local: copy dev.tfvars.example → dev.tfvars.

project     = "cht-reports"
environment = "dev"

# Images are overridden per deploy by workflow (-var 'lambda_images={...}')
lambda_images = {
  generator = "233636046512.dkr.ecr.us-east-1.amazonaws.com/cht-reports-dev-generator:1.0.0"
}

lambda_timeout     = 300
lambda_memory_size = 1024

generate_schedule_expression = "cron(0 6 * * ? *)"
enable_generate_schedule     = false

contenthub_base_url = "https://devhub.communityhealth.media/api/public"

# cht-platform-tool export contract (CPR-13/14), used by the ECS orchestration
# service, not the same target as contenthub_base_url above.
platform_tool_base_url = "https://devapp.communityhealth.media/api/export"

# Report-ready email (CPR-35): Platform API base, not the export path above.
platform_api_base_url = "https://devapp.communityhealth.media/api"

alarm_notification_emails = []
s3_force_destroy          = true

# ECS orchestration service. Image overridden per deploy by workflow.
reports_service_image_uri            = "233636046512.dkr.ecr.us-east-1.amazonaws.com/cht-reports-dev-service:1.0.0"
platform_cluster_name                = "cht-dev-cluster"
platform_vpc_name                    = "cht-dev-vpc"
platform_backend_security_group_name = "cht-dev-backend-sg"
service_connect_namespace_name       = "cht-dev.local"

# Reports M2M caller (imported from Hub). Hub still owns the `hub` RS.
cognito_user_pool_id         = "us-east-1_J51gzfO0I"
cognito_auth_domain          = "chm-dev.auth.us-east-1.amazoncognito.com"
contenthub_m2m_secret_name   = "cht-dev-cognito-m2m-reports"
reports_m2m_import_client_id = "3shbd05vgmmno67a1p8lua2kld"

# cht-platform-tool backend task role: enqueues report requests and writes
# report job items (CPR-34 / CPR-30).
platform_tool_role_arns = ["arn:aws:iam::233636046512:role/cht-dev-ecs-task"]
