# CHT Reports: production.github.tfvars
# Non-secret infra for GitHub Actions deploy-prod.yml (committed).
# Secrets: GitHub Environment "production" → TF_VAR_* (see .github/CI_CD.md).
# Local: copy production.tfvars.example → production.tfvars.

project     = "cht-reports"
environment = "production"

contenthub_base_url = "https://contenthub.communityhealth.media/api/public"

# cht-platform-tool export contract (CPR-13/14), used by the ECS orchestration
# service, not the same target as contenthub_base_url above.
platform_tool_base_url = "https://testapp.communityhealth.media/api/export"

# Report-ready email (CPR-35): Platform API base, not the export path above.
platform_api_base_url = "https://testapp.communityhealth.media/api"

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

# Reports M2M caller (imported from Hub). Hub still owns the `hub` RS.
cognito_user_pool_id         = "us-east-1_whXKKxAdX"
cognito_auth_domain          = "chm-platform.auth.us-east-1.amazoncognito.com"
contenthub_m2m_secret_name   = "cht-prod-cognito-m2m-reports"
reports_m2m_import_client_id = "6msgc72vd2umu51jua7h8k7qqj"

# cht-platform-tool backend task role: enqueues report requests and writes
# report job items (CPR-34 / CPR-30).
platform_tool_role_arns = ["arn:aws:iam::233636046512:role/cht-platform-ecs-task"]
