# cht-reports does not run its own ECS cluster or VPC. It joins the shared
# cht-dev-cluster / cht-platform-cluster (owned by cht-platform-tool) the same
# way cht-companion does: data-source lookups against the live cluster/VPC,
# not Terraform remote state. This puts cht-reports on the same Service
# Connect namespace (cht-dev.local / cht.local) as cht-platform-tool and
# cht-companion for free, since they already share that cluster.
#
# Two things are not reachable this way, for different reasons:
#   - cht-platform-tool's export API (CPR-13/14, sessions/attendance/survey
#     data): reached over plain HTTPS, not Service Connect, even though
#     cht-reports shares a cluster with cht-platform-tool. The export
#     contract is a public API surface, not an internal Service Connect
#     route. See modules/security/secrets-manager (PLATFORM_TOOL_API_KEY)
#     and the platform_tool_base_url variable in the root module.
#   - Content Hub: runs its own separate ECS cluster (contenthub-cluster /
#     contenthub-dev-cluster) with no shared VPC or Cloud Map bridge today.
#     cht-reports reaches its own reports.* schema there via a direct
#     Aurora connection string (schema-sharing design, not yet built), not
#     an HTTP API. Content Hub is a database cht-reports writes to, not a
#     service cht-reports calls.

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
