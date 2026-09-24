# Repositories are created by the deploy workflow before the first image
# push (Terraform runs after the push, so it can't create them in time).
# Terraform only looks them up for outputs and lifecycle policies.
data "aws_ecr_repository" "this" {
  for_each = toset(var.repository_names)

  name = each.value
}
