variable "resource_prefix" {
  description = "Name prefix"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "schedule_expression" {
  description = "EventBridge schedule (rate() or cron())"
  type        = string
}

variable "lambda_alias_arn" {
  description = "Lambda live alias ARN"
  type        = string
}

variable "lambda_function_name" {
  description = "Function name (for permission)"
  type        = string
}

variable "enabled" {
  description = "Whether the schedule is enabled"
  type        = bool
  default     = true
}
