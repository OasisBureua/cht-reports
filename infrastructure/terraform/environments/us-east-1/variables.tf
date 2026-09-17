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

variable "contenthub_base_url" {
  description = "Content Hub API base URL (non-secret)"
  type        = string
  default     = ""
}

variable "contenthub_api_key" {
  description = "Content Hub API key (GitHub Environment secret → TF_VAR_contenthub_api_key)"
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
