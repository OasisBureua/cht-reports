variable "resource_prefix" {
  type = string
}

variable "environment" {
  type = string
}

variable "secret_arns" {
  description = "Secrets Manager ARNs (with wildcard suffix) the execution role may read."
  type        = list(string)
}

variable "secrets_kms_key_arn" {
  type = string
}

variable "s3_bucket_arn" {
  description = "Reports bucket ARN, from modules.s3_reports.bucket_arn."
  type        = string
}

variable "report_ready_topic_arn" {
  type = string
}

variable "report_requests_queue_arn" {
  type = string
}

variable "dynamodb_table_arn" {
  type = string
}

variable "dynamodb_kms_key_arn" {
  type = string
}

variable "companion_bff_auth_secret_arn" {
  description = "cht-companion's BFF-auth secret ARN (COMPANION_INTERNAL_SECRET), for calling /generate."
  type        = string
}

variable "companion_kms_key_arn" {
  description = "cht-companion's shared KMS key ARN, needed to decrypt companion_bff_auth_secret_arn."
  type        = string
}
