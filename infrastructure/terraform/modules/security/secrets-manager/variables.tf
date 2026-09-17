variable "resource_prefix" {
  description = "Name prefix"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "kms_key_arn" {
  description = "KMS key for the secret"
  type        = string
}

variable "secret_values" {
  description = "Key/value pairs stored as JSON in the secret. Blank values are allowed for scaffold."
  type        = map(string)
  default     = {}
  sensitive   = true
}
