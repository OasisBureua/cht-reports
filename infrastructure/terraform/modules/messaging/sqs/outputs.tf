output "queue_url" {
  description = "Queue URL"
  value       = aws_sqs_queue.queue.url
}

output "queue_arn" {
  description = "Queue ARN"
  value       = aws_sqs_queue.queue.arn
}

output "queue_name" {
  description = "Queue name"
  value       = aws_sqs_queue.queue.name
}

output "dlq_url" {
  description = "DLQ URL"
  value       = aws_sqs_queue.dlq.url
}

output "dlq_arn" {
  description = "DLQ ARN"
  value       = aws_sqs_queue.dlq.arn
}
