variable "resource_prefix" {
  description = "Name prefix"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "lambda_function_name" {
  description = "Function to alarm on"
  type        = string
}

variable "sns_topic_arn" {
  description = "Alarm actions topic"
  type        = string
}
