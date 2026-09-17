resource "aws_sns_topic" "alerts" {
  name              = "${var.resource_prefix}-alerts"
  kms_master_key_id = var.kms_key_arn

  tags = {
    Name        = "${var.resource_prefix}-alerts"
    Environment = var.environment
  }
}

resource "aws_sns_topic_subscription" "email" {
  for_each = toset(var.alarm_notification_emails)

  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = each.value
}
