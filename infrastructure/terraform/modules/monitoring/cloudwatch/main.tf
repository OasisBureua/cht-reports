resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "${var.resource_prefix}-lambda-errors"
  alarm_description   = "Lambda errors > 0"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = var.lambda_function_name
  }

  alarm_actions = [var.sns_topic_arn]
  ok_actions    = [var.sns_topic_arn]

  tags = {
    Name        = "${var.resource_prefix}-lambda-errors"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  alarm_name          = "${var.resource_prefix}-lambda-throttles"
  alarm_description   = "Lambda throttles > 0"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = var.lambda_function_name
  }

  alarm_actions = [var.sns_topic_arn]

  tags = {
    Name        = "${var.resource_prefix}-lambda-throttles"
    Environment = var.environment
  }
}
