# Getting started

## Repo layout

| Path | Role |
|------|------|
| `lambdas/<name>/` | One containerized Lambda per folder (`Dockerfile`, handler, tests) |
| `infrastructure/terraform/` | AWS IaC (ECR, Lambda image functions, S3, SQS, EventBridge) |
| `scripts/` | CI helpers, image tags, local verify/deploy |

There is no frontend or long-running API in this repo.

## Prerequisites

- Python 3.12+
- Docker Desktop
- Terraform >= 1.10.5
- AWS CLI v2 (deploys and `smoke.sh`)

## Run Lambda tests

```bash
cd lambdas/generator
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
pytest
```

From the repo root:

```bash
./scripts/verify.sh
./scripts/verify.sh lambda
./scripts/verify.sh infra
```

## Add a Lambda

1. Copy `lambdas/generator/` to `lambdas/<name>/`.
2. Give it a `Dockerfile` whose `CMD` is `handler.handler`.
3. Add the ECR repo name to `local.ecr_repository_names` in `infrastructure/terraform/environments/us-east-1/main.tf`.
4. Add the image URI to `lambda_images` in `*.github.tfvars` / `*.tfvars.example`.
5. CI builds every `lambdas/*/Dockerfile` when the lambda lane runs.

## Environment variables (Lambda)

Set in Terraform (`lambda_environment`) and/or Secrets Manager:

| Name | Purpose |
|------|---------|
| `ENVIRONMENT` | `dev` or `production` |
| `REPORTS_BUCKET` | S3 bucket for artifacts |
| `CONTENTHUB_BASE_URL` | Content Hub API (when wired) |

Secrets belong in GitHub Environments (`development`, `production`) as `TF_VAR_*`. Do not commit `dev.tfvars` / `production.tfvars`.
