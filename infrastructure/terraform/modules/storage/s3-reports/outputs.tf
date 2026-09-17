output "bucket_id" {
  description = "Reports bucket name"
  value       = aws_s3_bucket.reports.id
}

output "bucket_arn" {
  description = "Reports bucket ARN"
  value       = aws_s3_bucket.reports.arn
}
