# CHT Reports infrastructure

AWS infrastructure for containerized report Lambdas using Terraform.

## Architecture

```
┌──────────────────────────────────────────────┐
│              EventBridge schedule             │
└──────────────────────┬───────────────────────┘
                       ▼
        ┌──────────────────────────────┐
        │  SQS generate queue + DLQ    │
        └──────────────┬───────────────┘
                       ▼
        ┌──────────────────────────────┐
        │  Lambda (container image)    │
        │  alias: live                 │
        └──────────────┬───────────────┘
                       ▼
        ┌──────────────────────────────┐
        │  S3 reports bucket (KMS)     │
        └──────────────────────────────┘
```

## Modules

### Security
- **KMS**: keys for S3, Secrets Manager, SQS, CloudWatch, SNS
- **Secrets Manager**: integration credentials

### Compute
- **ECR**: one repository per Lambda
- **Lambda container**: Image-based functions + `live` alias

### Storage
- **S3 reports**: generated artifacts

### Messaging
- **SQS**: generate jobs with DLQ
- **EventBridge**: scheduled invoke of `live`
- **SNS**: alarm notifications

### Monitoring
- **CloudWatch**: Lambda error/throttle alarms

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
- Never commit `.env`, `production.tfvars`, or `dev.tfvars`.

## Support

See [docs/](../docs/) and [.github/CI_CD.md](../.github/CI_CD.md).
