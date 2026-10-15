output "client_id" {
  description = "cht-reports-m2m-{env} Cognito app client id"
  value       = aws_cognito_user_pool_client.this.id
}

output "client_name" {
  description = "Cognito app client name"
  value       = aws_cognito_user_pool_client.this.name
}

output "secret_name" {
  description = "Secrets Manager name"
  value       = aws_secretsmanager_secret.this.name
}

output "secret_arn" {
  description = "Secrets Manager ARN"
  value       = aws_secretsmanager_secret.this.arn
}
