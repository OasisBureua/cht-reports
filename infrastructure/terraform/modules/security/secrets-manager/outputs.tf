output "secret_arn" {
  description = "App secrets ARN"
  value       = aws_secretsmanager_secret.app.arn
}

output "secret_name" {
  description = "App secrets name"
  value       = aws_secretsmanager_secret.app.name
}
