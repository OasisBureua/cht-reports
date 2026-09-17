# Terraform remote state keys

Production and dev use the **same** Terraform code under `us-east-1/` but **separate S3 state files** so a dev apply never replaces production resources.

| Environment | State key |
| ----------- | --------- |
| production  | `us-east-1-production/terraform.tfstate` |
| dev         | `us-east-1-dev/terraform.tfstate` |

Bucket: `cht-reports-terraform-state` (create once; see `infrastructure/README.md`).

## Init before plan/apply

```bash
cd infrastructure/terraform/environments/us-east-1
terraform init -reconfigure -backend-config=../backends/us-east-1-dev.hcl
terraform plan -var-file=../variables/dev.tfvars
```

Or use `./scripts/deploy-primary.sh dev` (selects the backend config automatically).

**Important:** Always `-reconfigure` when switching between production and dev in the same directory.
