# CHT Reports infrastructure

AWS infrastructure for the report generation service, using Terraform.

## Architecture

```
cht-platform-tool (generate BFF)
   │  PutItem cht-{env}-report-state   (DynamoDB, global: us-east-1 + us-east-2)
   │  SendMessage { reportId }
   ▼
SQS cht-{env}-report-requests  (+ cht-{env}-report-requests_dlq)
   ▼
ECS service cht-reports-{env} (shared platform cluster, Service Connect)
   │  Content Hub GET /api/campaigns/{id}/report-packet
   │  cht-companion /generate
   ▼
S3 reports bucket (KMS, vN keys, Standard-IA after 30 days)
   ▼
cht-platform-tool POST /api/internal/reports/{id}/ready ──► SES email (CPR-35)
```

## Modules

### Security
- **KMS**: keys for S3, Secrets Manager, SQS, CloudWatch, SNS
- **Secrets Manager**: integration credentials
- **Reports M2M**: Cognito app client `cht-reports-m2m-{env}` + SM `cht-{env}-cognito-m2m-reports` (imported; Hub owns the `hub` RS)

### Compute
- **ECR**: the worker image repository (created by the deploy workflow, looked up here)
- **ECS**: the report worker service on the shared platform cluster

### Storage
- **S3 reports**: generated artifacts

### Messaging
- **SQS**: generate jobs with DLQ
- **SNS**: alarm notifications

### Monitoring
- **CloudWatch**: report failure rate, DLQ depth and worker-not-running alarms (CPR-53)

## Prerequisites

1. AWS account with OIDC role for GitHub Actions
2. Terraform >= 1.10
3. S3 bucket `cht-reports-terraform-state` (create once; see below)
4. Docker images pushed to ECR (CI does this before apply)

## Quick start

### 1. Create Terraform state backend

```bash
aws s3 mb s3://cht-reports-terraform-state --region us-east-1
aws s3api put-bucket-versioning \
  --bucket cht-reports-terraform-state \
  --versioning-configuration Status=Enabled
```

State locking uses S3 native lockfiles (`use_lockfile = true`), same as cht-platform-tool.

### 2. Configure variables

```bash
cp infrastructure/terraform/environments/variables/dev.tfvars.example \
   infrastructure/terraform/environments/variables/dev.tfvars
```

CI uses committed `*.github.tfvars` plus GitHub Environment secrets as `TF_VAR_*`.

### 3. Deploy

```bash
./scripts/deploy-primary.sh dev
./scripts/deploy-primary.sh production
```

From `infrastructure/terraform`:

```bash
./scripts/deploy.sh us-east-1 init
./scripts/deploy.sh us-east-1 plan
./scripts/deploy.sh us-east-1 apply
```

Always `-reconfigure` when switching between production and dev in the same directory.

## GitHub Actions IAM

- Workflows use **OIDC** (`AWS_ROLE_ARN`), not long-lived access keys.
- Separate roles: `GitHubActions-CHT-Reports-Dev` and `GitHubActions-CHT-Reports-Prod`.
- Scoped policies: `iam/github-actions-deploy-policy-dev.json` and `iam/github-actions-deploy-policy-prod.json`.
- They still grant `lambda:*` and `events:*` so Terraform can destroy the old generator Lambda and its EventBridge rule (CPR-53). Removing them is a follow-up, applied only after both the dev and production applies have destroyed the Lambda.
- Never commit `.env`, `production.tfvars`, or `dev.tfvars`.

## Support

See [docs/](../docs/) and [.github/CI_CD.md](../.github/CI_CD.md).
