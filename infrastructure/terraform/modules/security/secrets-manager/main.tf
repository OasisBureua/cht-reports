resource "aws_secretsmanager_secret" "app" {
  name                    = "${var.resource_prefix}-app-secrets"
  description             = "CHT Reports application secrets (${var.environment})"
  kms_key_id              = var.kms_key_arn
  recovery_window_in_days = var.environment == "production" ? 30 : 0

  tags = {
    Name        = "${var.resource_prefix}-app-secrets"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id     = aws_secretsmanager_secret.app.id
  secret_string = jsonencode(var.secret_values)

  lifecycle {
    ignore_changes = [secret_string]
  }
}
