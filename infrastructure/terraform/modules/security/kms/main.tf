locals {
  prefix = var.environment == "production" ? "${var.project}-prod" : "${var.project}-${var.environment}"
}

resource "aws_kms_key" "s3" {
  description             = "${local.prefix} S3 encryption key"
  deletion_window_in_days = var.deletion_window_in_days
  enable_key_rotation     = true
  policy                  = local.s3_key_policy

  tags = {
    Name        = "${local.prefix}-s3-key"
    Environment = var.environment
    Service     = "s3"
  }
}

resource "aws_kms_alias" "s3" {
  name          = "alias/${local.prefix}-s3"
  target_key_id = aws_kms_key.s3.key_id
}

resource "aws_kms_key" "secrets" {
  description             = "${local.prefix} Secrets Manager encryption key"
  deletion_window_in_days = var.deletion_window_in_days
  enable_key_rotation     = true

  tags = {
    Name        = "${local.prefix}-secrets-key"
    Environment = var.environment
    Service     = "secrets-manager"
  }
}

resource "aws_kms_alias" "secrets" {
  name          = "alias/${local.prefix}-secrets"
  target_key_id = aws_kms_key.secrets.key_id
}

resource "aws_kms_key" "sqs" {
  description             = "${local.prefix} SQS encryption key"
  deletion_window_in_days = var.deletion_window_in_days
  enable_key_rotation     = true
  policy                  = local.sqs_key_policy

  tags = {
    Name        = "${local.prefix}-sqs-key"
    Environment = var.environment
    Service     = "sqs"
  }
}

resource "aws_kms_alias" "sqs" {
  name          = "alias/${local.prefix}-sqs"
  target_key_id = aws_kms_key.sqs.key_id
}

resource "aws_kms_key" "cloudwatch" {
  description             = "${local.prefix} CloudWatch Logs encryption key"
  deletion_window_in_days = var.deletion_window_in_days
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnableIAMUserPermissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${var.aws_account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "AllowCloudWatchLogs"
        Effect = "Allow"
        Principal = {
          Service = "logs.${var.aws_region}.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:CreateGrant",
          "kms:DescribeKey"
        ]
        Resource = "*"
        Condition = {
          ArnLike = {
            "kms:EncryptionContext:aws:logs:arn" = "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:*"
          }
        }
      }
    ]
  })

  tags = {
    Name        = "${local.prefix}-cloudwatch-key"
    Environment = var.environment
    Service     = "cloudwatch"
  }
}

resource "aws_kms_alias" "cloudwatch" {
  name          = "alias/${local.prefix}-cloudwatch"
  target_key_id = aws_kms_key.cloudwatch.key_id
}

resource "aws_kms_key" "dynamodb" {
  description             = "${local.prefix} DynamoDB encryption key"
  deletion_window_in_days = var.deletion_window_in_days
  enable_key_rotation     = true
  policy                  = local.dynamodb_key_policy

  tags = {
    Name        = "${local.prefix}-dynamodb-key"
    Environment = var.environment
    Service     = "dynamodb"
  }
}

resource "aws_kms_alias" "dynamodb" {
  name          = "alias/${local.prefix}-dynamodb"
  target_key_id = aws_kms_key.dynamodb.key_id
}

resource "aws_kms_key" "sns" {
  description             = "${local.prefix} SNS encryption key"
  deletion_window_in_days = var.deletion_window_in_days
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnableIAMUserPermissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${var.aws_account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "AllowSnsService"
        Effect = "Allow"
        Principal = {
          Service = "sns.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey*"
        ]
        Resource = "*"
      },
      {
        Sid    = "AllowCloudWatchEncrypt"
        Effect = "Allow"
        Principal = {
          Service = "cloudwatch.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey*"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "${local.prefix}-sns-key"
    Environment = var.environment
    Service     = "sns"
  }
}

resource "aws_kms_alias" "sns" {
  name          = "alias/${local.prefix}-sns"
  target_key_id = aws_kms_key.sns.key_id
}

# SQS, DynamoDB, and S3 keys: account-root (IAM policies keep working for
# this repo's own roles), plus cht-platform-tool's task role via the
# matching kms:ViaService. Without the S3 statement, Platform GetObject on
# SSE-KMS artifacts fails even with a bucket policy.
locals {
  root_key_statement = {
    Sid       = "EnableRootAccountPermissions"
    Effect    = "Allow"
    Principal = { AWS = "arn:aws:iam::${var.aws_account_id}:root" }
    Action    = "kms:*"
    Resource  = "*"
  }

  s3_key_policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat([local.root_key_statement], length(var.platform_tool_role_arns) == 0 ? [] : [{
      Sid       = "PlatformToolViaS3"
      Effect    = "Allow"
      Principal = { AWS = var.platform_tool_role_arns }
      Action    = ["kms:Decrypt"]
      Resource  = "*"
      Condition = { StringEquals = { "kms:ViaService" = "s3.${var.aws_region}.amazonaws.com" } }
    }])
  })

  sqs_key_policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat([local.root_key_statement], length(var.platform_tool_role_arns) == 0 ? [] : [{
      Sid       = "PlatformToolViaSqs"
      Effect    = "Allow"
      Principal = { AWS = var.platform_tool_role_arns }
      Action    = ["kms:GenerateDataKey", "kms:Decrypt"]
      Resource  = "*"
      Condition = { StringEquals = { "kms:ViaService" = "sqs.${var.aws_region}.amazonaws.com" } }
    }])
  })

  dynamodb_key_policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat([local.root_key_statement], length(var.platform_tool_role_arns) == 0 ? [] : [{
      Sid       = "PlatformToolViaDynamoDB"
      Effect    = "Allow"
      Principal = { AWS = var.platform_tool_role_arns }
      Action    = ["kms:Encrypt", "kms:Decrypt", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:DescribeKey", "kms:CreateGrant"]
      Resource  = "*"
      Condition = { StringEquals = { "kms:ViaService" = "dynamodb.${var.aws_region}.amazonaws.com" } }
    }])
  })
}
