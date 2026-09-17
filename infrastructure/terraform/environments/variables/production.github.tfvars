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

alarm_notification_emails = [
  "uchenna@communityhealth.media",
  "sebastien@communityhealth.media",
]
s3_force_destroy = false
