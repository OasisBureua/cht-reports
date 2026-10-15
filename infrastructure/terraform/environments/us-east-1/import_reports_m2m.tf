# First apply after Hub `removed { destroy = false }` imports the live
# client and secret. Harmless no-op once they are in this state. Leave
# reports_m2m_import_client_id empty only if you are creating a new env.

import {
  for_each = var.reports_m2m_import_client_id == "" ? toset([]) : toset(["import"])
  to       = module.reports_m2m[0].aws_cognito_user_pool_client.this
  id       = "${var.cognito_user_pool_id}/${var.reports_m2m_import_client_id}"
}

import {
  for_each = var.reports_m2m_import_client_id == "" ? toset([]) : toset(["import"])
  to       = module.reports_m2m[0].aws_secretsmanager_secret.this
  id       = local.reports_m2m_secret_name
}