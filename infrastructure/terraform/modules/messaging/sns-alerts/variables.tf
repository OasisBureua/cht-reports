variable "resource_prefix" {
  description = "Name prefix"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "kms_key_arn" {
  description = "KMS key for the topic"
  type        = string
}

variable "alarm_notification_emails" {
  description = "Email subscriptions for alarms"
  type        = list(string)
  default     = []
}
