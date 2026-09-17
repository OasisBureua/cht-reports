# Terraform Modules

Implemented now:

```
modules/
├── compute/ecr/
├── compute/ecr-lifecycle/
├── compute/lambda-container/
├── security/kms/
├── security/secrets-manager/
├── storage/s3-reports/
├── messaging/sqs/
├── messaging/eventbridge-lambda/
├── messaging/sns-alerts/
└── monitoring/cloudwatch/
```

Placeholders (fill in like cht-platform-tool when the backend lands on ECS):

```
modules/
├── compute/ecs-cluster/
├── compute/ecs-backend/
├── networking/vpc/
├── networking/alb/
└── database/rds/
```

Each implemented module has `main.tf`, `variables.tf`, and `outputs.tf`.
