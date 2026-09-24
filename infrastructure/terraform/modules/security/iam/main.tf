# Execution + task roles for the cht-reports ECS service. Naming and shape
# mirror cht-companion's modules/security/iam (${prefix}-ecs-execution,
# ${prefix}-ecs-task), since this is the closest real precedent for a
# Bedrock-calling NestJS/FastAPI service on Fargate in this org.

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_execution" {
  name               = "${var.resource_prefix}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json

  tags = {
    Name        = "${var.resource_prefix}-ecs-execution"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Execution role needs to pull secrets referenced in the task def's
# "secrets" block (ECR pull uses the managed policy above; this covers
# injecting Secrets Manager values as container env vars at task start).
data "aws_iam_policy_document" "ecs_execution_secrets" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = concat(var.secret_arns, [var.companion_bff_auth_secret_arn])
  }

  statement {
    actions   = ["kms:Decrypt"]
    resources = [var.secrets_kms_key_arn, var.companion_kms_key_arn]
  }
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name   = "${var.resource_prefix}-ecs-execution-secrets"
  role   = aws_iam_role.ecs_execution.id
  policy = data.aws_iam_policy_document.ecs_execution_secrets.json
}

resource "aws_iam_role" "ecs_task" {
  name               = "${var.resource_prefix}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json

  tags = {
    Name        = "${var.resource_prefix}-ecs-task"
    Environment = var.environment
  }
}

# No direct bedrock:InvokeModel grant here. cht-reports generates via
# cht-companion's Bedrock InvokeModel call over Service Connect, not its
# own direct AWS API call. cht-companion owns the model-id config, auth,
# and structured no-payload-logging pattern for Bedrock in this org. Don't
# re-add this statement without first confirming that architecture
# decision has changed.

# Task role needs to write generated reports to S3 and publish to the
# report-ready SNS topic.
data "aws_iam_policy_document" "task_reports_io" {
  statement {
    sid       = "ReportsBucketWrite"
    actions   = ["s3:PutObject", "s3:GetObject"]
    resources = ["${var.s3_bucket_arn}/*"]
  }

  statement {
    sid       = "ReportReadyPublish"
    actions   = ["sns:Publish"]
    resources = [var.report_ready_topic_arn]
  }

  statement {
    sid       = "ReportRequestsConsume"
    actions   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
    resources = [var.report_requests_queue_arn]
  }
}

resource "aws_iam_role_policy" "task_reports_io" {
  name   = "${var.resource_prefix}-ecs-task-reports-io"
  role   = aws_iam_role.ecs_task.id
  policy = data.aws_iam_policy_document.task_reports_io.json
}

# Generation-state and retry-count tracking (max 5 attempts). Single
# table, no GSIs needed. Every access is a get/put/update by request_id.
data "aws_iam_policy_document" "task_generation_state" {
  statement {
    sid = "GenerationStateReadWrite"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
    ]
    resources = [var.dynamodb_table_arn, "${var.dynamodb_table_arn}/index/*"]
  }

  statement {
    sid       = "GenerationStateKms"
    actions   = ["kms:Decrypt", "kms:GenerateDataKey"]
    resources = [var.dynamodb_kms_key_arn]
  }
}

resource "aws_iam_role_policy" "task_generation_state" {
  name   = "${var.resource_prefix}-ecs-task-generation-state"
  role   = aws_iam_role.ecs_task.id
  policy = data.aws_iam_policy_document.task_generation_state.json
}
