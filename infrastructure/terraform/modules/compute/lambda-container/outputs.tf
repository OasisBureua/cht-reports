output "function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.this.function_name
}

output "function_arn" {
  description = "Unqualified function ARN"
  value       = aws_lambda_function.this.arn
}

output "qualified_arn" {
  description = "Published version ARN"
  value       = aws_lambda_function.this.qualified_arn
}

output "version" {
  description = "Published version"
  value       = aws_lambda_function.this.version
}

output "image_uri" {
  description = "Image URI currently applied"
  value       = aws_lambda_function.this.image_uri
}

output "live_alias_arn" {
  description = "ARN of the live alias"
  value       = aws_lambda_alias.live.arn
}

output "live_alias_name" {
  description = "Alias name"
  value       = aws_lambda_alias.live.name
}

output "role_arn" {
  description = "Execution role ARN"
  value       = aws_iam_role.lambda.arn
}

output "log_group_name" {
  description = "CloudWatch log group"
  value       = aws_cloudwatch_log_group.lambda.name
}
