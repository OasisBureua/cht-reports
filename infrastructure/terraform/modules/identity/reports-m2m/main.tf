# Reports' Cognito M2M caller. Hub owns the `hub` resource server (including
# hub/reports.read). Platform owns platform/reports.notify. Companion owns
# companion/generate.invoke. This module owns the app client + SM secret.
#
# Import the live client and secret. Do not create a second client.

locals {
  env_label   = contains(["prod", "production", "platform"], var.environment) ? "prod" : var.environment
  client_name = "cht-reports-m2m-${local.env_label}"
}

resource "aws_cognito_user_pool_client" "this" {
  name         = local.client_name
  user_pool_id = var.user_pool_id

  generate_secret                      = true
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["client_credentials"]
  allowed_oauth_scopes = [
    var.hub_reports_scope,
    var.platform_notify_scope,
    var.companion_generate_scope,
  ]
  supported_identity_providers  = ["COGNITO"]
  prevent_user_existence_errors = "ENABLED"

  token_validity_units {
    access_token = "hours"
  }
  access_token_validity = 1

  lifecycle {
    prevent_destroy = true
    # Import leaves generate_secret unset; the provider then reads it as true
    # (hashicorp/aws#20298). Ignore it so we never ForceNew-replace the live
    # client. After the first apply, state has generate_secret = true.
    ignore_changes = [generate_secret]
  }
}

resource "aws_secretsmanager_secret" "this" {
  name                    = var.secret_name
  description             = "Cognito M2M for cht-reports (${var.hub_reports_scope}, ${var.platform_notify_scope}, ${var.companion_generate_scope}). Client ${local.client_name}."
  recovery_window_in_days = contains(["prod", "production"], var.environment) ? 30 : 7

  tags = {
    Name        = var.secret_name
    Environment = var.environment
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_secretsmanager_secret_version" "this" {
  secret_id = aws_secretsmanager_secret.this.id
  secret_string = jsonencode({
    client_id     = aws_cognito_user_pool_client.this.id
    client_secret = aws_cognito_user_pool_client.this.client_secret
    token_url     = var.token_url
    scope         = var.hub_reports_scope
  })
}
