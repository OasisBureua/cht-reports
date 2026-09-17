variable "repository_names" {
  description = "Existing ECR repository names to attach lifecycle policies to."
  type        = list(string)
}
