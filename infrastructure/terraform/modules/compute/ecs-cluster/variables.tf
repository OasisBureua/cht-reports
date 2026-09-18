variable "platform_cluster_name" {
  description = "Existing cht-platform-tool ECS cluster to join (cht-dev-cluster / cht-platform-cluster)."
  type        = string
}

variable "platform_vpc_name" {
  description = "Name tag on cht-platform-tool's existing VPC."
  type        = string
}

variable "platform_backend_security_group_name" {
  description = "Name tag on cht-platform-tool's backend security group, used to scope Service Connect ingress."
  type        = string
}

variable "service_connect_namespace_name" {
  description = "Existing Service Connect HTTP namespace shared by cht-platform-tool and cht-companion (cht-dev.local / cht.local)."
  type        = string
}
