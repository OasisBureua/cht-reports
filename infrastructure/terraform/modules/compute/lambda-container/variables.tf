variable "resource_prefix" {
  description = "Name prefix (e.g. cht-reports-dev)"
  type        = string
}

variable "name" {
  description = "Short function name (e.g. generator). Full name is prefix-name."
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "image_uri" {
  description = "ECR image URI including tag"
  type        = string
}

variable "timeout" {
  description = "Timeout in seconds"
  type        = number
  default     = 300
}

variable "memory_size" {
  description = "Memory in MB"
  type        = number
  default     = 1024
}

variable "architecture" {
  description = "Lambda architecture"
  type        = string
  default     = "x86_64"
}

variable "environment_variables" {
  description = "Plain environment variables"
  type        = map(string)
  default     = {}
}

variable "log_retention_days" {
  description = "CloudWatch log retention"
  type        = number
  default     = 7
}

variable "cloudwatch_kms_key_arn" {
  description = "KMS key ARN for log group encryption"
  type        = string
}

variable "s3_bucket_arn" {
  description = "Reports bucket ARN (object access)"
  type        = string
}

variable "sqs_queue_arn" {
  description = "Generate queue ARN (consume). Empty to skip SQS permissions."
  type        = string
  default     = ""
}

variable "secrets_arn" {
  description = "Secrets Manager secret ARN. Empty to skip."
  type        = string
  default     = ""
}

variable "kms_key_arns" {
  description = "KMS keys the function may use (decrypt env/S3/SQS/secrets)"
  type        = list(string)
  default     = []
}

variable "reserved_concurrent_executions" {
  description = "Optional reserved concurrency. Null = unreserved."
  type        = number
  default     = null
}
