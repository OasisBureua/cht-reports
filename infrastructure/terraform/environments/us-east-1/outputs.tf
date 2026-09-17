output "resource_prefix" {
  description = "Name prefix used for AWS resources"
  value       = local.resource_prefix
}

output "ecr_repository_urls" {
  description = "ECR repository URLs keyed by repo name"
  value       = module.ecr.repository_urls
}

output "lambda_function_names" {
  description = "Lambda function names keyed by short name"
  value       = { for k, m in module.lambda : k => m.function_name }
}

output "lambda_live_alias_arns" {
  description = "Live alias ARNs keyed by short name"
  value       = { for k, m in module.lambda : k => m.live_alias_arn }
}

output "lambda_image_uris" {
  description = "Currently applied image URIs keyed by short name"
  value       = { for k, m in module.lambda : k => m.image_uri }
}

output "lambda_versions" {
  description = "Published versions keyed by short name"
  value       = { for k, m in module.lambda : k => m.version }
}

output "reports_bucket" {
  description = "S3 bucket for report artifacts"
  value       = module.s3_reports.bucket_id
}

output "generate_queue_url" {
  description = "SQS generate queue URL"
  value       = module.sqs.queue_url
}

output "generate_queue_arn" {
  description = "SQS generate queue ARN"
  value       = module.sqs.queue_arn
}

output "alerts_topic_arn" {
  description = "SNS alerts topic"
  value       = module.sns_alerts.topic_arn
}

output "app_secrets_arn" {
  description = "Secrets Manager ARN"
  value       = module.secrets.secret_arn
}

output "generate_schedule_rule" {
  description = "EventBridge generate rule name"
  value       = module.generate_schedule.rule_name
}
