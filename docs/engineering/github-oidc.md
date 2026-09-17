# GitHub Actions OIDC (AWS)

Separate IAM roles per environment. No long-lived AWS access keys.

Account: `233636046512`. Region: `us-east-1`. Repo: `OasisBureua/cht-reports`.

| GitHub Environment | IAM role | ECR repos | Deploy workflow |
|--------------------|----------|-----------|-----------------|
| `development` | `GitHubActions-CHT-Reports-Dev` | `cht-reports-dev-*` | `deploy-dev.yml` |
| `production` | `GitHubActions-CHT-Reports-Prod` | `cht-reports-prod-*` | `deploy-prod.yml` |

Each role’s trust is locked to that GitHub Environment (`…:environment:development` or `…:environment:production`). Dev cannot assume Prod, and vice versa.

---

## What you do

You already created `GitHubActions-CHT-Reports` (shared). **Do not use it.** Create the two env-specific roles, then you can delete the old one.

### 1. AWS CLI

```bash
aws sts get-caller-identity
# Account must be 233636046512
```

### 2. Create the Dev role

```bash
./infrastructure/aws-github-oidc-setup.sh development
```

Copy: `arn:aws:iam::233636046512:role/GitHubActions-CHT-Reports-Dev`

### 3. Create the Prod role

```bash
./infrastructure/aws-github-oidc-setup.sh production
```

Copy: `arn:aws:iam::233636046512:role/GitHubActions-CHT-Reports-Prod`

### 4. GitHub Environments

Repo → **Settings → Environments**. Create `development` and `production` (not `platform`).

| Environment | Secret `AWS_ROLE_ARN` |
|-------------|------------------------|
| `development` | `arn:aws:iam::233636046512:role/GitHubActions-CHT-Reports-Dev` |
| `production` | `arn:aws:iam::233636046512:role/GitHubActions-CHT-Reports-Prod` |

Optional later: extra `TF_VAR_*` secrets on the same environments.

### 5. Optional: delete the unused shared role

```bash
aws iam detach-role-policy \
  --role-name GitHubActions-CHT-Reports \
  --policy-arn arn:aws:iam::233636046512:policy/GitHubActions-CHT-Reports-Deploy
aws iam delete-role --role-name GitHubActions-CHT-Reports
```

If the detach fails, list attached policies first:

```bash
aws iam list-attached-role-policies --role-name GitHubActions-CHT-Reports
```

### 6. Terraform state bucket (once)

```bash
aws s3 mb s3://cht-reports-terraform-state --region us-east-1
aws s3api put-bucket-versioning \
  --bucket cht-reports-terraform-state \
  --versioning-configuration Status=Enabled
```

### 7. Confirm

- Actions → **Deploy to Development** → Run workflow (`plan_only` is fine).
- Later: **Deploy to Production** only after `production` has its own `AWS_ROLE_ARN`.
