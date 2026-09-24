variable "resource_prefix" {
  type = string
}

variable "environment" {
  type = string
}

variable "kms_key_arn" {
  type = string
}

variable "platform_tool_role_arns" {
  description = "cht-platform-tool task role ARNs allowed to create, read, list and update report items."
  type        = list(string)
  default     = []
}

variable "table_name" {
  description = "Report job table name, e.g. cht-dev-report-state."
  type        = string
}

variable "replicas" {
  description = "Global table replicas: region plus a KMS key in that region."
  type = list(object({
    region      = string
    kms_key_arn = string
  }))
  default = []
}
