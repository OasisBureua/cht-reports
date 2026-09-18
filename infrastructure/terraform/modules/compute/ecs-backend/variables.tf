variable "resource_prefix" {
  description = "Name prefix, e.g. cht-dev-reports / cht-reports."
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "image_uri" {
  description = "ECR image URI (with tag) for the reports NestJS service."
  type        = string
}

variable "container_port" {
  description = "Port the NestJS service listens on."
  type        = number
  default     = 3000
}

variable "task_cpu" {
  description = "Fargate task CPU units. 512 matches cht-companion (comparable async, Bedrock-calling workload)."
  type        = number
  default     = 512
}

variable "task_memory" {
  description = "Fargate task memory (MB). 1024 matches cht-companion; revisit if DOCX rendering needs more headroom."
  type        = number
  default     = 1024
}

variable "desired_count" {
  description = "Desired task count."
  type        = number
  default     = 1
}

variable "min_capacity" {
  type    = number
  default = 1
}

variable "max_capacity" {
  type    = number
  default = 2
}

variable "execution_role_arn" {
  type = string
}

variable "task_role_arn" {
  type = string
}

variable "cluster_id" {
  description = "From modules.ecs_cluster.cluster_id (the shared platform cluster, joined via data source)."
  type        = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "platform_backend_security_group_id" {
  description = "From modules.ecs_cluster.platform_backend_security_group_id, scopes Service Connect ingress."
  type        = string
}

variable "service_connect_namespace_arn" {
  type = string
}

variable "service_connect_dns_name" {
  description = "Service Connect client_alias DNS name other services use to reach cht-reports, e.g. cht-reports."
  type        = string
  default     = "cht-reports"
}

variable "environment_variables" {
  description = "Non-secret container env vars."
  type        = map(string)
  default     = {}
}

variable "secret_arns" {
  description = "Map of container env var name to Secrets Manager ARN (with JSON key suffix)."
  type        = map(string)
  default     = {}
}
