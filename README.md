# CHT Reports

Report worker (NestJS on ECS) + Terraform. No frontend.

The worker consumes SQS report requests and runs as an ECS service on the
shared platform cluster (no VPC or ALB of its own). See [docs/](docs/).

```
cht-reports/
├── backend/          # NestJS API
├── infrastructure/   # Terraform + GitHub OIDC
├── docs/
└── scripts/
```

- Local checks: `./scripts/verify.sh`
- CI/CD: [.github/CI_CD.md](.github/CI_CD.md)
- GitHub OIDC (do this first): [docs/engineering/github-oidc.md](docs/engineering/github-oidc.md)
