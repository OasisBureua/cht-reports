variable "resource_prefix" {
  description = "Name prefix"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "kms_key_arn" {
  description = "KMS key for bucket encryption"
  type        = string
}

variable "force_destroy" {
  description = "Allow terraform destroy to empty the bucket"
  type        = bool
  default     = false
}
