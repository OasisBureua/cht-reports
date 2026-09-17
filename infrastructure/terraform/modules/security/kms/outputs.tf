output "s3_kms_key_id" {
  description = "S3 KMS key ID"
  value       = aws_kms_key.s3.id
}

output "s3_kms_key_arn" {
  description = "S3 KMS key ARN"
  value       = aws_kms_key.s3.arn
}

output "secrets_kms_key_id" {
  description = "Secrets Manager KMS key ID"
  value       = aws_kms_key.secrets.id
}

output "secrets_kms_key_arn" {
  description = "Secrets Manager KMS key ARN"
  value       = aws_kms_key.secrets.arn
}

output "sqs_kms_key_id" {
  description = "SQS KMS key ID"
  value       = aws_kms_key.sqs.id
}

output "sqs_kms_key_arn" {
  description = "SQS KMS key ARN"
  value       = aws_kms_key.sqs.arn
}

output "cloudwatch_kms_key_id" {
  description = "CloudWatch KMS key ID"
  value       = aws_kms_key.cloudwatch.id
}

output "cloudwatch_kms_key_arn" {
  description = "CloudWatch KMS key ARN"
  value       = aws_kms_key.cloudwatch.arn
}

output "dynamodb_kms_key_id" {
  description = "DynamoDB KMS key ID"
  value       = aws_kms_key.dynamodb.id
}

output "dynamodb_kms_key_arn" {
  description = "DynamoDB KMS key ARN"
  value       = aws_kms_key.dynamodb.arn
}

output "sns_kms_key_id" {
  description = "SNS KMS key ID"
  value       = aws_kms_key.sns.id
}

output "sns_kms_key_arn" {
  description = "SNS KMS key ARN"
  value       = aws_kms_key.sns.arn
}
