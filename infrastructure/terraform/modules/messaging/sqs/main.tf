resource "aws_sqs_queue" "dlq" {
  name                       = "${var.resource_prefix}-generate-dlq"
  sqs_managed_sse_enabled    = false
  kms_master_key_id          = var.kms_key_arn
  message_retention_seconds  = 1209600
  visibility_timeout_seconds = var.visibility_timeout_seconds

  tags = {
    Name        = "${var.resource_prefix}-generate-dlq"
    Environment = var.environment
  }
}

resource "aws_sqs_queue" "generate" {
  name                       = "${var.resource_prefix}-generate"
  sqs_managed_sse_enabled    = false
  kms_master_key_id          = var.kms_key_arn
  visibility_timeout_seconds = var.visibility_timeout_seconds
  message_retention_seconds  = var.message_retention_seconds

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = var.max_receive_count
  })

  tags = {
    Name        = "${var.resource_prefix}-generate"
    Environment = var.environment
  }
}
