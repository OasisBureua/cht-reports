# Getting started

## Repo layout

| Path | Role |
|------|------|
| `backend/` | NestJS generate worker (`src/reports/`, `src/aws/`, `src/companion/`) |
| `infrastructure/terraform/` | AWS IaC (ECR, ECS service, S3, SQS, DynamoDB, alarms) |
| `scripts/` | CI helpers, image tags, local verify/deploy |

There is no public frontend in this repo. HTTP on the worker is health only.

## Prerequisites

- Node.js 24
- Docker Desktop
- Terraform >= 1.10.5
- AWS CLI v2 (deploys and `smoke.sh`)

## Run checks

From the repo root:

```bash
./scripts/verify.sh
./scripts/verify.sh backend
./scripts/verify.sh infra
```

## Environment variables (ECS worker)

Set in Terraform (`ecs_backend` environment_variables / secret_arns):

| Name | Purpose |
|------|---------|
| `CONTENTHUB_BASE_URL` | Content Hub origin or `/api/public` (rewritten to `/api/admin`) |
| `CONTENTHUB_API_KEY` | S2S key for `GET .../report-packet` |
| `REPORT_REQUESTS_QUEUE_URL` | Generate SQS queue |
| `GENERATION_STATE_TABLE` | DynamoDB job table |
| `CONTENTHUB_M2M_*` | Cognito client_credentials for Hub, Platform notify, and companion `/generate` (this repo owns `cht-reports-m2m-*`) |

Secrets belong in GitHub Environments (`development`, `production`) as `TF_VAR_*`. Do not commit `dev.tfvars` / `production.tfvars`.
