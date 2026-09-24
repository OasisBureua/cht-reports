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
