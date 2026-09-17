# Architecture

CHT Reports is a Lambda-only service. The CHT Platform admin UI and NestJS API stay in `cht-platform-tool`. This repo builds report artifacts and stores them in S3.

```
  EventBridge schedule          CHT Platform / Content Hub
           │                              │
           ▼                              ▼
     ┌─────────────┐               ┌─────────────┐
     │  SQS queue  │◄──────────────│  (future)   │
     │  + DLQ      │  generate job │  API invoke │
     └──────┬──────┘               └─────────────┘
            │
            ▼
  ┌─────────────────────┐
  │ Lambda (container)  │  ECR image, alias `live`
  │  lambdas/generator  │
  └──────────┬──────────┘
             │
             ▼
        S3 reports bucket (KMS)
```

## Compute

Each function under `lambdas/` is built as a container image, pushed to ECR, and deployed as `package_type = Image`.

- Terraform publishes a numbered Lambda version on every image change.
- Alias `live` always points at the version from the last apply.
- EventBridge and SQS target `live`, not `$LATEST`.
- Rollback moves `live` to a previous version (see `rollback.yml`).

## Why containers (not zip)

- Same Docker/ECR/semver tagging flow as cht-platform-tool.
- Room for native deps (PDF, charts) without Lambda layer packaging.
- Image size and 15-minute timeout fit report generation better than a zip + layer stack.

## Environments

| Name | Prefix | GitHub Environment | Domain / notes |
|------|--------|--------------------|----------------|
| Dev | `cht-reports-dev` | `development` | Isolated stack, `cht-reports-dev-*` ECR |
| Production | `cht-reports-prod` | `production` | Isolated stack, `cht-reports-prod-*` ECR |

AWS region: `us-east-1`. Account: `233636046512`.

Account-level GuardDuty / CloudTrail / AWS Config stay in cht-platform-tool so this stack does not duplicate them.

## First Lambda: `generator`

Placeholder handler. Replace with report-build logic (Content Hub snapshots, PDF/JSON artifacts) as product work lands. Keep the folder contract: `Dockerfile`, `handler.py`, `tests/`.
