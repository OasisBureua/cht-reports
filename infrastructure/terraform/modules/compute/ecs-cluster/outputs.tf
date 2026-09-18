output "cluster_id" {
  value = data.aws_ecs_cluster.platform.id
}

output "cluster_arn" {
  value = data.aws_ecs_cluster.platform.arn
}

output "vpc_id" {
  value = data.aws_vpc.platform.id
}

output "private_subnet_ids" {
  value = data.aws_subnets.platform_private.ids
}

output "platform_backend_security_group_id" {
  value = data.aws_security_group.platform_backend.id
}

output "service_connect_namespace_arn" {
  value = data.aws_service_discovery_http_namespace.platform.arn
}
