output "topic_arn" {
  description = "Alerts topic ARN"
  value       = aws_sns_topic.alerts.arn
}

output "topic_name" {
  description = "Alerts topic name"
  value       = aws_sns_topic.alerts.name
}
