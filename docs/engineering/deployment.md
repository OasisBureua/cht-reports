# Deployment

## Environments

| Name | GitHub Environment | Workflow | ECR repos | IAM role |
|------|--------------------|----------|-----------|----------|
| Dev | `development` | `deploy-dev.yml` | `cht-reports-dev-*` | `GitHubActions-CHT-Reports-Dev` |
| Production | `production` | `deploy-prod.yml` | `cht-reports-prod-*` | `GitHubActions-CHT-Reports-Prod` |

AWS region: `us-east-1`. ECR registry: `233636046512.dkr.ecr.us-east-1.amazonaws.com`.

Image tags:

- Dev: `1.0.0`, `1.0.1`, … and `dev-latest`
- Production: `v1.0.0`, `v1.0.1`, … and `prod-latest`

OIDC setup: [github-oidc.md](./github-oidc.md).

## Automatic deploys (GitHub Actions)

Same lane model as cht-platform-tool, without a frontend:

| Lane | Paths | What runs |
|------|--------|-----------|
| Backend | `backend/**` | Tests + image build/push |
| Lambda | `lambdas/**` | Tests, image build/push, Terraform pins `lambda_images` |
| Infra | `infrastructure/**` | Terraform plan/apply (existing image tags from state) |

### Dev

Manual only: Actions → **Deploy to Development** → Run workflow.

### Production

Manual only: Actions → **Deploy to Production** → Run workflow.

## Manual deploy (Terraform)

```bash
./scripts/deploy-primary.sh dev
./scripts/deploy-primary.sh production
```

## GitHub secrets

`AWS_ROLE_ARN` is **different** on each Environment. See [github-oidc.md](./github-oidc.md).

```bash
./scripts/verify-github-env-secrets.sh development
./scripts/verify-github-env-secrets.sh production
```

## Rollback

Actions → **Rollback Deployment** → `production` or `development` + Lambda version.

## Post-deploy smoke

```bash
./scripts/smoke.sh dev
./scripts/smoke.sh production
```
