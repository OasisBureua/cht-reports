# cht-reports NestJS orchestration service. Joins the shared platform
# cluster/namespace (see modules/compute/ecs-cluster) the same way
# cht-companion does: Service Connect, no ALB, no public ingress. This
# service does the whole report-generation orchestration: take a request
# from CHT, pull Zoom/survey input data from cht-platform-tool's export
# contract (CPR-13/14, PLATFORM_TOOL_BASE_URL + PLATFORM_TOOL_API_KEY),
# call cht-companion's /generate for the Bedrock completion, render the
# DOCX template, write its own reports.* schema and the rendered doc to
# Content Hub's Aurora and S3, publish to the report-ready SNS topic.
#
# Reachability:
#   - cht-platform-tool and cht-companion: Service Connect DNS, same
#     namespace, free once this service joins the shared cluster.
#   - cht-platform-tool's export API specifically: plain HTTPS to its
#     public API (PLATFORM_TOOL_BASE_URL + PLATFORM_TOOL_API_KEY), same
#     pattern cht-platform-tool itself already uses to reach other
#     upstream services. No Service Connect path exists to Content Hub
#     either. It runs its own separate cluster and VPC. cht-reports
#     reaches its own reports.* schema there via Aurora connection string,
#     not an HTTP API (see the schema-sharing design work, not yet built).

locals {
  service_dns_name = var.service_connect_dns_name
}

resource "aws_ecs_task_definition" "reports" {
  family                   = local.resource_prefix
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = "reports"
      image     = var.image_uri
      essential = true

      portMappings = [
        {
          name          = local.service_dns_name
          containerPort = var.container_port
          protocol      = "tcp"
        }
      ]

      environment = [
        for k, v in var.environment_variables : { name = k, value = v }
      ]

      secrets = [
        for k, arn in var.secret_arns : { name = k, valueFrom = arn }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/${local.resource_prefix}"
          "awslogs-region"        = "us-east-1"
          "awslogs-stream-prefix" = "reports"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:${var.container_port}/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 30
      }
    }
  ])

  tags = {
    Name        = local.resource_prefix
    Environment = var.environment
  }
}

resource "aws_security_group" "reports" {
  name_prefix = "${local.resource_prefix}-sg-"
  description = "cht-reports task security group"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${local.resource_prefix}-sg"
    Environment = var.environment
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Allow inbound Service Connect traffic from the platform backend security
# group only. No public ingress, no ALB, same posture as cht-companion.
resource "aws_security_group_rule" "from_platform_backend" {
  type                     = "ingress"
  from_port                = var.container_port
  to_port                  = var.container_port
  protocol                 = "tcp"
  security_group_id        = aws_security_group.reports.id
  source_security_group_id = var.platform_backend_security_group_id
}

resource "aws_ecs_service" "reports" {
  name            = local.resource_prefix
  cluster         = var.cluster_id
  task_definition = aws_ecs_task_definition.reports.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.reports.id]
    assign_public_ip = false
  }

  service_connect_configuration {
    enabled   = true
    namespace = var.service_connect_namespace_arn

    service {
      port_name      = local.service_dns_name
      discovery_name = local.service_dns_name

      client_alias {
        port     = var.container_port
        dns_name = local.service_dns_name
      }
    }
  }

  deployment_circuit_breaker {
    enable   = var.environment == "production"
    rollback = var.environment == "production"
  }

  tags = {
    Name        = local.resource_prefix
    Environment = var.environment
  }
}

resource "aws_appautoscaling_target" "reports" {
  max_capacity       = var.max_capacity
  min_capacity       = var.min_capacity
  resource_id        = "service/${var.cluster_id}/${aws_ecs_service.reports.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "reports_cpu" {
  name               = "${local.resource_prefix}-cpu-target"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.reports.resource_id
  scalable_dimension = aws_appautoscaling_target.reports.scalable_dimension
  service_namespace  = aws_appautoscaling_target.reports.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70
  }
}
