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
| Backend | `backend/**` | Tests + image build/push + Terraform plan/apply (moves the ECS service to the new image), then waits for the worker |
| Infra | `infrastructure/**` | Terraform plan/apply (keeps the image from state), then waits for the worker |

### Dev

A push to `develop` or `feature/**` that touches `backend/**`,
`infrastructure/**`, `scripts/**` or `.github/workflows/**` deploys dev. Also
manual: Actions → **Deploy to Development** → Run workflow.

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

Run **Deploy to Development** or **Deploy to Production** with `image_tag` set
to an existing worker image tag (`1.0.31` in dev, `v1.0.12` in production).
The run skips change detection, tests and the image build, checks the tag
exists in ECR, plans Terraform with that image, waits for **approve** on the
issue it opens, applies, then waits for the worker. Production rollbacks must
run from `main`. Terraform state keeps the rolled-back image, so infra-only
deploys keep it too; the next backend deploy moves forward again.

## Post-deploy check

Deploys and rollbacks wait for the ECS service to settle and check its tasks
are running. CI also passes the image it applied and fails if the service
settled on another one (e.g. the deployment circuit breaker rolled back):

```bash
./scripts/smoke.sh dev
./scripts/smoke.sh production
```
