output "repository_urls" {
  description = "Map of repository name to repository URL"
  value       = { for name, repo in data.aws_ecr_repository.this : name => repo.repository_url }
}

output "repository_arns" {
  description = "Map of repository name to ARN"
  value       = { for name, repo in data.aws_ecr_repository.this : name => repo.arn }
}

output "repository_names" {
  description = "Repository names"
  value       = [for repo in data.aws_ecr_repository.this : repo.name]
}
