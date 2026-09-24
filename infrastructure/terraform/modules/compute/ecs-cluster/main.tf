# cht-reports does not run its own ECS cluster or VPC. It joins the shared
# cht-dev-cluster / cht-platform-cluster (owned by cht-platform-tool) the same
# way cht-companion does: data-source lookups against the live cluster/VPC,
# not Terraform remote state. This puts cht-reports on the same Service
# Connect namespace (cht-dev.local / cht.local) as cht-platform-tool and
# cht-companion for free, since they already share that cluster.
#
# Content Hub is not on this cluster (contenthub-cluster / contenthub-dev-cluster,
# no shared VPC or Cloud Map). cht-reports reaches it over HTTPS:
# GET /api/campaigns/{id}/report-packet with CONTENTHUB_API_KEY.
# cht-reports has no Aurora role. Platform-tool export is Hub ingest, not
# this worker.

data "aws_ecs_cluster" "platform" {
  cluster_name = var.platform_cluster_name
}

data "aws_vpc" "platform" {
  filter {
    name   = "tag:Name"
    values = [var.platform_vpc_name]
  }
}

data "aws_subnets" "platform_private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.platform.id]
  }

  tags = {
    Tier = "private"
  }
}

data "aws_security_group" "platform_backend" {
  filter {
    name   = "tag:Name"
    values = [var.platform_backend_security_group_name]
  }
}

data "aws_service_discovery_http_namespace" "platform" {
  name = var.service_connect_namespace_name
}
