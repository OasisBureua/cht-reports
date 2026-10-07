# CI/CD

Same workflow set as cht-platform-tool. This repo has **no frontend**. Lanes are
backend, optional containerized lambdas, and infra.

## Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pr-validation.yml` | Pull requests | Backend tests/build, lambda tests, Terraform validate |
| `branch-policy.yml` | PRs → `main` | Require head branch `release/*` or `hotfix/*` |
| `security-monthly.yml` | First Monday monthly | npm audit, pip/Trivy filesystem scan |
| `deploy-dev.yml` | Push to `develop` or `feature/**`, or manual (`workflow_dispatch`) | Images → `cht-reports-dev-*` ECR, Terraform apply dev |
| `deploy-prod.yml` | Manual (`workflow_dispatch`) | Images → `cht-reports-prod-*` ECR, Terraform apply production |
| `rollback.yml` | Manual | Roll back Lambda `live` alias (ECS rollback when that module exists) |

Docs-only changes under `docs/**` do not trigger deploy.

## Deploy scope

| Lane | Paths | What runs |
|------|--------|-----------|
| Backend | `backend/**` | Tests + image build/push (`cht-reports-dev-service` / `cht-reports-prod-service`) + Terraform plan/apply (rolls the ECS service to the new image) |
| Lambda | `lambdas/**` | Tests + image build/push + Terraform image pin |
| Infra | `infrastructure/**` | Terraform plan/apply |

Manual **Run workflow** has `deploy_all` (default off) to force every lane.

## Terraform apply approval

Deploys stop after `terraform plan` and open a GitHub issue. Only the user who triggered the run (usually whoever merged) can approve it: comment **approve** on the issue. The run waits up to 2 hours. The AWS role is re-assumed after approval, so a slow approval no longer fails the apply on expired credentials.

## Branch flow

```text
feature/**  →  push deploys to dev (this workflow)
       ↓
    develop  →  push deploys to dev
       ↓
release/vX.Y.Z
       ↓
 PR release/* or hotfix/* → main  (no deploy)

Dev also: Actions → Deploy to Development → Run workflow
Prod: Actions → Deploy to Production → Run workflow (manual only)
```

Pushes to `main`, `release/*`, and `hotfix/*` do **not** run deploy-dev. Docs-only changes under `docs/**` do not trigger deploy.

GitHub **rulesets** on `main`: require PRs, require checks
`main-from-release-only` and `release-contains-develop`. Same as
cht-platform-tool (see that repo’s `.github/CI_CD.md` for the ruleset table).

## OIDC

Separate IAM roles per GitHub Environment:

| Environment | Role |
|-------------|------|
| `development` | `GitHubActions-CHT-Reports-Dev` |
| `production` | `GitHubActions-CHT-Reports-Prod` |

Setup: [docs/engineering/github-oidc.md](../docs/engineering/github-oidc.md).

## Image tags

- Dev: `1.0.0`, `1.0.1`, … and `dev-latest`
- Production: `v1.0.0`, `v1.0.1`, … and `prod-latest`

## Local verification

```bash
./scripts/verify.sh
./scripts/verify-github-env-secrets.sh development
```
