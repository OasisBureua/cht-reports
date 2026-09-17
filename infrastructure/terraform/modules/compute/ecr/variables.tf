variable "repository_names" {
  description = "ECR repository names to create"
  type        = list(string)
}

variable "scan_on_push" {
  description = "Scan images on push"
  type        = bool
  default     = true
}

variable "image_tag_mutability" {
  description = "MUTABLE or IMMUTABLE"
  type        = string
  default     = "MUTABLE"
}

variable "tags" {
  description = "Extra tags"
  type        = map(string)
  default     = {}
}
