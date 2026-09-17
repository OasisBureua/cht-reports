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

alarm_notification_emails = []
s3_force_destroy          = true
