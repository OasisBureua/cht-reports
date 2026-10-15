variable "environment" {
  description = "Environment name (dev / production). Collapses to prod for resource names."
  type        = string
}

variable "user_pool_id" {
  description = "Shared CHT Cognito user pool id."
  type        = string
}

variable "token_url" {
  description = "Cognito OAuth2 token URL (https://{auth-domain}/oauth2/token)."
  type        = string
}

variable "secret_name" {
  description = "Secrets Manager name for the reports M2M JSON (cht-{env}-cognito-m2m-reports)."
  type        = string
}

variable "hub_reports_scope" {
  description = "Hub packet scope stored in SM `scope` and allowed on the client."
  type        = string
  default     = "hub/reports.read"
}

variable "platform_notify_scope" {
  description = "Platform report-ready notify scope allowed on the client."
  type        = string
  default     = "platform/reports.notify"
}

variable "companion_generate_scope" {
  description = "Companion /generate scope allowed on the client."
  type        = string
  default     = "companion/generate.invoke"
}
