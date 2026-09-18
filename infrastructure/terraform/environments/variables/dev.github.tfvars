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
enable_generate_schedule     = true

contenthub_base_url = "https://devhub.communityhealth.media/api/public"

# cht-platform-tool export contract (CPR-13/14), used by the ECS orchestration
# service, not the same target as contenthub_base_url above.
platform_tool_base_url = "https://devapp.communityhealth.media/api/export"

alarm_notification_emails = []
s3_force_destroy          = true

# ECS orchestration service. Image overridden per deploy by workflow.
reports_service_image_uri            = "233636046512.dkr.ecr.us-east-1.amazonaws.com/cht-reports-dev-service:1.0.0"
platform_cluster_name                = "cht-dev-cluster"
platform_vpc_name                    = "cht-dev-vpc"
platform_backend_security_group_name = "cht-dev-backend-sg"
service_connect_namespace_name       = "cht-dev.local"
companion_bff_auth_secret_name       = "cht-dev-companion-bff-auth"
companion_kms_alias                  = "alias/cht-dev-companion"
