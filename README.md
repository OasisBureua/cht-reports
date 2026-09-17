# CHT Reports

Backend + optional containerized Lambdas + Terraform. No frontend.

Folders are in place; NestJS feature modules and remaining Terraform modules
(ECS, VPC, ALB) get added as the app is built. README will be expanded later.

```
cht-reports/
├── backend/          # NestJS API
├── lambdas/          # Containerized Lambdas (optional)
├── infrastructure/   # Terraform + GitHub OIDC
├── docs/
└── scripts/
```

- Local checks: `./scripts/verify.sh`
- CI/CD: [.github/CI_CD.md](.github/CI_CD.md)
- GitHub OIDC (do this first): [docs/engineering/github-oidc.md](docs/engineering/github-oidc.md)
