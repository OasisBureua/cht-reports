output "errors_alarm_name" {
  description = "Lambda errors alarm"
  value       = aws_cloudwatch_metric_alarm.lambda_errors.alarm_name
}

output "throttles_alarm_name" {
  description = "Lambda throttles alarm"
  value       = aws_cloudwatch_metric_alarm.lambda_throttles.alarm_name
}
