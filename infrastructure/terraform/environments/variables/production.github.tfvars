# CHT Reports: production.github.tfvars
# Non-secret infra for GitHub Actions deploy-prod.yml (committed).
# Secrets: GitHub Environment "production" → TF_VAR_* (see .github/CI_CD.md).
# Local: copy production.tfvars.example → production.tfvars.

project     = "cht-reports"
environment = "production"

# Images overridden per deploy by workflow (-var 'lambda_images={...}')
lambda_images = {
  generator = "233636046512.dkr.ecr.us-east-1.amazonaws.com/cht-reports-prod-generator:v1.0.0"
}

lambda_timeout     = 300
lambda_memory_size = 1024

generate_schedule_expression = "cron(0 6 * * ? *)"
enable_generate_schedule     = true

contenthub_base_url = "https://contenthub.communityhealth.media/api/public"

# cht-platform-tool export contract (CPR-13/14), used by the ECS orchestration
# service, not the same target as contenthub_base_url above.
platform_tool_base_url = "https://testapp.communityhealth.media/api/export"

alarm_notification_emails = [
  "uchenna@communityhealth.media",
  "sebastien@communityhealth.media",
]
s3_force_destroy = false

# ECS orchestration service. See production.tfvars.example for the caveat
# on platform_vpc_name / platform_backend_security_group_name.
reports_service_image_uri            = "233636046512.dkr.ecr.us-east-1.amazonaws.com/cht-reports-prod-service:v1.0.0"
platform_cluster_name                = "cht-platform-cluster"
platform_vpc_name                    = "cht-platform-vpc"
platform_backend_security_group_name = "cht-platform-backend-sg"
service_connect_namespace_name       = "cht.local"
companion_bff_auth_secret_name       = "cht-companion-bff-auth"
companion_kms_alias                  = "alias/cht-companion"
