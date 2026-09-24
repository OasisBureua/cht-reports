# Report job table (CPR-34). One item per report, updated in place, kept
# indefinitely (no TTL). cht-platform-tool's generate BFF (CPR-30) creates
# the item, takes the per-campaign lock, and lists by campaign; the
# cht-reports worker only updates the item as the report progresses.
#
# Keyed by campaign so every repo can find a campaign's reports:
#   campaign_id = <campaignId>, report_id = <reportId>              a report
#   campaign_id = <campaignId>, report_id = LOCK#<templateType>     generate lock
# Lookup by reportId alone (GET /api/reports/:id, the SQS worker) uses the
# report_id GSI. Separate from the reports.* Postgres schema on Content
# Hub's Aurora.

resource "aws_dynamodb_table" "report_generation_state" {
  name         = var.table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "campaign_id"
  range_key    = "report_id"

  attribute {
    name = "campaign_id"
    type = "S"
  }

  attribute {
    name = "report_id"
    type = "S"
  }

  global_secondary_index {
    name            = "report_id-index"
    hash_key        = "report_id"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = var.kms_key_arn
  }

  point_in_time_recovery {
    enabled = var.environment == "production"
  }

  tags = {
    Name        = var.table_name
    Environment = var.environment
  }
}

# Lets cht-platform-tool's backend task role create, read, list and update
# report items without an IAM change in that repo.
resource "aws_dynamodb_resource_policy" "platform_tool" {
  count = length(var.platform_tool_role_arns) > 0 ? 1 : 0

  resource_arn = aws_dynamodb_table.report_generation_state.arn
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PlatformToolReportJobs"
        Effect    = "Allow"
        Principal = { AWS = var.platform_tool_role_arns }
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:ConditionCheckItem",
        ]
        Resource = [
          aws_dynamodb_table.report_generation_state.arn,
          "${aws_dynamodb_table.report_generation_state.arn}/index/*",
        ]
      },
    ]
  })
}
