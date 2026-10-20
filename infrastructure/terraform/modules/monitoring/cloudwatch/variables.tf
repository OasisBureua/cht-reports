variable "resource_prefix" {
  description = "Name prefix"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "sns_topic_arn" {
  description = "Alarm actions topic"
  type        = string
}

variable "log_group_name" {
  description = "Report worker log group"
  type        = string
}

variable "cluster_name" {
  description = "ECS cluster the worker runs in"
  type        = string
}

variable "service_name" {
  description = "Report worker ECS service"
  type        = string
}

variable "dlq_name" {
  description = "Report requests dead-letter queue"
  type        = string
}

variable "failure_rate_threshold_percent" {
  description = "Alarm when more than this share of attempts fail in an hour"
  type        = number
  default     = 5
}
