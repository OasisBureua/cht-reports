resource "aws_s3_bucket" "reports" {
  bucket        = "${var.resource_prefix}-artifacts"
  force_destroy = var.force_destroy

  tags = {
    Name        = "${var.resource_prefix}-artifacts"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_versioning" "reports" {
  bucket = aws_s3_bucket.reports.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "reports" {
  bucket = aws_s3_bucket.reports.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "reports" {
  bucket                  = aws_s3_bucket.reports.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Platform streams PDFs through cht-dev-ecs-task / cht-platform-ecs-task.
# Same resource-policy pattern as the report-state table and request queue.
resource "aws_s3_bucket_policy" "platform_tool_read" {
  count = length(var.platform_tool_role_arns) > 0 ? 1 : 0

  bucket = aws_s3_bucket.reports.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PlatformToolGetReports"
        Effect    = "Allow"
        Principal = { AWS = var.platform_tool_role_arns }
        Action    = ["s3:GetObject"]
        Resource  = ["${aws_s3_bucket.reports.arn}/reports/*"]
      },
    ]
  })
}

resource "aws_s3_bucket_lifecycle_configuration" "reports" {
  bucket = aws_s3_bucket.reports.id

  rule {
    id     = "expire-noncurrent"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}
