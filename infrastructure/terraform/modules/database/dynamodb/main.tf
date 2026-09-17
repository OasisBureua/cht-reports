# Per-request generation state: tracks pipeline progress and caps retries
# (max 5 iterations) so a failing step doesn't loop forever. Separate from
# the reports.* Postgres schema on Content Hub's Aurora. This table is
# orchestration and retry bookkeeping, not report content, and the ECS
# service reads and writes it far more often (every retry attempt) than
# belongs in a relational schema shared with Content Hub's own migrations.

resource "aws_dynamodb_table" "report_generation_state" {
  name         = "${var.resource_prefix}-generation-state"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "request_id"

  attribute {
    name = "request_id"
    type = "S"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = var.kms_key_arn
  }

  point_in_time_recovery {
    enabled = var.environment == "production"
  }

  tags = {
    Name        = "${var.resource_prefix}-generation-state"
    Environment = var.environment
  }
}
