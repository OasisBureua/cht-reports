output "service_name" {
  value = aws_ecs_service.reports.name
}

output "task_definition_arn" {
  value = aws_ecs_task_definition.reports.arn
}

output "security_group_id" {
  value = aws_security_group.reports.id
}

output "service_connect_dns_name" {
  description = "How other services on the shared namespace reach cht-reports, e.g. http://cht-reports:3000."
  value       = local.service_dns_name
}
