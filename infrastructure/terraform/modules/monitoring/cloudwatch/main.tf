# Report worker alarms (CPR-53). All notify the alerts topic, and again when
# they clear.

locals {
  namespace = "CHTReports/${var.environment}"
}

# The worker logs one line per finished attempt; these count them.
resource "aws_cloudwatch_log_metric_filter" "completed" {
  name           = "${var.resource_prefix}-reports-completed"
  log_group_name = var.log_group_name
  # "Request <id> complete: reports/<campaign>/<id>/v<N>.pdf"
  pattern = "\"complete: reports/\""

  metric_transformation {
    name          = "ReportsCompleted"
    namespace     = local.namespace
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "failed" {
  name           = "${var.resource_prefix}-reports-failed"
  log_group_name = var.log_group_name
  # "Request <id> failed: <reason>", or the transcript wait giving up.
  pattern = "?\"failed:\" ?\"gave up waiting for transcript\""

  metric_transformation {
    name          = "ReportsFailed"
    namespace     = local.namespace
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "failure_rate" {
  alarm_name          = "${var.resource_prefix}-report-failure-rate"
  alarm_description   = "More than ${var.failure_rate_threshold_percent}% of report attempts failed in the last hour"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = var.failure_rate_threshold_percent
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "rate"
    expression  = "IF(failed + completed > 0, 100 * failed / (failed + completed), 0)"
    label       = "Failed attempts (%)"
    return_data = true
  }

  metric_query {
    id = "failed"
    metric {
      metric_name = "ReportsFailed"
      namespace   = local.namespace
      period      = 3600
      stat        = "Sum"
    }
  }

  metric_query {
    id = "completed"
    metric {
      metric_name = "ReportsCompleted"
      namespace   = local.namespace
      period      = 3600
      stat        = "Sum"
    }
  }

  alarm_actions = [var.sns_topic_arn]
  ok_actions    = [var.sns_topic_arn]

  tags = {
    Name        = "${var.resource_prefix}-report-failure-rate"
    Environment = var.environment
  }
}

# A message lands here after the queue's maxReceiveCount failed receives.
resource "aws_cloudwatch_metric_alarm" "dlq_depth" {
  alarm_name          = "${var.resource_prefix}-report-dlq-depth"
  alarm_description   = "Report requests in the dead-letter queue"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Maximum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = var.dlq_name
  }

  alarm_actions = [var.sns_topic_arn]
  ok_actions    = [var.sns_topic_arn]

  tags = {
    Name        = "${var.resource_prefix}-report-dlq-depth"
    Environment = var.environment
  }
}

# ECS publishes service CPU once a minute per running task. No samples for
# ten minutes means no task is running.
resource "aws_cloudwatch_metric_alarm" "service_down" {
  alarm_name          = "${var.resource_prefix}-worker-not-running"
  alarm_description   = "No report worker task running for 10 minutes"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "SampleCount"
  threshold           = 1
  treat_missing_data  = "breaching"

  dimensions = {
    ClusterName = var.cluster_name
    ServiceName = var.service_name
  }

  alarm_actions = [var.sns_topic_arn]
  ok_actions    = [var.sns_topic_arn]

  tags = {
    Name        = "${var.resource_prefix}-worker-not-running"
    Environment = var.environment
  }
}
