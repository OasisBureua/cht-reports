locals {
  function_name = "${var.resource_prefix}-${var.name}"
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.cloudwatch_kms_key_arn

  tags = {
    Name        = "${local.function_name}-logs"
    Environment = var.environment
  }
}

data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${local.function_name}-role"
  assume_role_policy = data.aws_iam_policy_document.assume.json

  tags = {
    Name        = "${local.function_name}-role"
    Environment = var.environment
  }
}

data "aws_iam_policy_document" "lambda" {
  statement {
    sid = "Logs"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["${aws_cloudwatch_log_group.lambda.arn}:*"]
  }

  statement {
    sid = "S3Reports"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket",
    ]
    resources = [
      var.s3_bucket_arn,
      "${var.s3_bucket_arn}/*",
    ]
  }

  dynamic "statement" {
    for_each = var.sqs_queue_arn != "" ? [var.sqs_queue_arn] : []
    content {
      sid = "SqsConsume"
      actions = [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
        "sqs:ChangeMessageVisibility",
      ]
      resources = [statement.value]
    }
  }

  dynamic "statement" {
    for_each = var.secrets_arn != "" ? [var.secrets_arn] : []
    content {
      sid       = "Secrets"
      actions   = ["secretsmanager:GetSecretValue"]
      resources = [statement.value]
    }
  }

  dynamic "statement" {
    for_each = length(var.kms_key_arns) > 0 ? [1] : []
    content {
      sid = "Kms"
      actions = [
        "kms:Decrypt",
        "kms:Encrypt",
        "kms:GenerateDataKey",
        "kms:DescribeKey",
      ]
      resources = var.kms_key_arns
    }
  }
}

resource "aws_iam_role_policy" "lambda" {
  name   = "${local.function_name}-policy"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda.json
}

resource "aws_lambda_function" "this" {
  function_name                  = local.function_name
  role                           = aws_iam_role.lambda.arn
  package_type                   = "Image"
  image_uri                      = var.image_uri
  timeout                        = var.timeout
  memory_size                    = var.memory_size
  architectures                  = [var.architecture]
  publish                        = true
  reserved_concurrent_executions = var.reserved_concurrent_executions

  environment {
    variables = var.environment_variables
  }

  tracing_config {
    mode = "Active"
  }

  tags = {
    Name        = local.function_name
    Environment = var.environment
  }

  depends_on = [
    aws_cloudwatch_log_group.lambda,
    aws_iam_role_policy.lambda,
  ]
}

resource "aws_lambda_alias" "live" {
  name             = "live"
  description      = "Traffic alias used by EventBridge and SQS"
  function_name    = aws_lambda_function.this.function_name
  function_version = aws_lambda_function.this.version
}
