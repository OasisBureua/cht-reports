variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name (dev / production)"
  type        = string
}

variable "lambda_images" {
  description = "Map of short Lambda name to ECR image URI (including tag)."
  type        = map(string)
}

variable "lambda_timeout" {
  description = "Generator timeout in seconds"
  type        = number
  default     = 300
}

variable "lambda_memory_size" {
  description = "Generator memory in MB"
  type        = number
  default     = 1024
}

variable "generate_schedule_expression" {
  description = "EventBridge schedule for report generation"
  type        = string
  default     = "cron(0 6 * * ? *)"
}

variable "enable_generate_schedule" {
  description = "Enable the EventBridge generate rule"
  type        = bool
  default     = true
}

# Origin or /api/public URL. The Nest worker rewrites to /api/admin for
# GET .../campaigns/{id}/report-packet.
variable "contenthub_base_url" {
  description = "Content Hub API base URL (non-secret). Worker rewrites /api/public → /api/admin."
  type        = string
  default     = ""
}

variable "contenthub_api_key" {
  description = "Content Hub API key (GitHub Environment secret → TF_VAR_contenthub_api_key)"
  type        = string
  default     = ""
  sensitive   = true
}

# Unused by the ECS worker (packet comes from Content Hub). Kept so existing
# GitHub TF_VAR_* / tfvars do not break until those secrets are retired.
variable "platform_tool_base_url" {
  description = "Unused by cht-reports worker (Hub packet API). Placeholder for existing tfvars."
  type        = string
  default     = ""
}

variable "platform_tool_api_key" {
  description = "Unused by cht-reports worker. Placeholder so existing GitHub TF_VAR_* do not break."
  type        = string
  default     = ""
  sensitive   = true
}

variable "alarm_notification_emails" {
  description = "Emails subscribed to the alerts SNS topic"
  type        = list(string)
  default     = []
}

variable "s3_force_destroy" {
  description = "Allow terraform destroy to empty the reports bucket (dev only)"
  type        = bool
  default     = false
}

# ============================================
# ECS orchestration service (joins the shared platform cluster)
# ============================================

variable "platform_cluster_name" {
  description = "cht-platform-tool's existing ECS cluster to join (cht-dev-cluster / cht-platform-cluster)."
  type        = string
}

variable "platform_vpc_name" {
  description = "Name tag on cht-platform-tool's existing VPC."
  type        = string
}

variable "platform_backend_security_group_name" {
  description = "Name tag on cht-platform-tool's backend security group, scopes Service Connect ingress."
  type        = string
}

variable "service_connect_namespace_name" {
  description = "Existing Service Connect namespace shared by cht-platform-tool and cht-companion (cht-dev.local / cht.local)."
  type        = string
}

variable "reports_service_image_uri" {
  description = "ECR image URI (with tag) for the cht-reports NestJS orchestration service."
  type        = string
}

variable "report_request_visibility_timeout_seconds" {
  description = "Visibility timeout for the on-demand report-requests queue. Must exceed the longest expected generation time, not the Lambda timeout."
  type        = number
  default     = 900
}

# ============================================
# cht-companion cross-repo references (for calling POST /generate)
# ============================================

variable "companion_bff_auth_secret_name" {
  description = "cht-companion's BFF-auth Secrets Manager secret name (cht-dev-companion-bff-auth / cht-companion-bff-auth)."
  type        = string
}

variable "companion_kms_alias" {
  description = "cht-companion's shared KMS key alias (alias/cht-dev-companion / alias/cht-companion)."
  type        = string
}
