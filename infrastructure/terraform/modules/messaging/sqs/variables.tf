variable "name" {
  description = "Queue name, e.g. cht-dev-report-requests. The DLQ is <name>_dlq."
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "kms_key_arn" {
  description = "KMS key for SQS encryption"
  type        = string
}

variable "visibility_timeout_seconds" {
  description = "Must exceed the consumer's processing time"
  type        = number
  default     = 360
}

variable "message_retention_seconds" {
  description = "How long messages stay on the queue"
  type        = number
  default     = 345600
}

variable "max_receive_count" {
  description = "Receives before DLQ"
  type        = number
  default     = 3
}
