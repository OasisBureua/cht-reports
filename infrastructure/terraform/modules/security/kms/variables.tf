variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "aws_account_id" {
  description = "AWS account ID"
  type        = string
}

variable "deletion_window_in_days" {
  description = "KMS key deletion window in days"
  type        = number
  default     = 30
}

variable "platform_tool_role_arns" {
  description = "cht-platform-tool task role ARNs (SQS send, DynamoDB write, artifacts GetObject + KMS via S3)."
  type        = list(string)
  default     = []
}
