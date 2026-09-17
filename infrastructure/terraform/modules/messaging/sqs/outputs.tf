output "queue_url" {
  description = "Generate queue URL"
  value       = aws_sqs_queue.generate.url
}

output "queue_arn" {
  description = "Generate queue ARN"
  value       = aws_sqs_queue.generate.arn
}

output "queue_name" {
  description = "Generate queue name"
  value       = aws_sqs_queue.generate.name
}

output "dlq_url" {
  description = "DLQ URL"
  value       = aws_sqs_queue.dlq.url
}

output "dlq_arn" {
  description = "DLQ ARN"
  value       = aws_sqs_queue.dlq.arn
}
