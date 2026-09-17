#!/usr/bin/env bash
# Local Terraform apply for cht-reports (us-east-1).
# Usage: ./scripts/deploy-primary.sh [production|dev]
set -euo pipefail

ENV=${1:-production}

case "$ENV" in
  production|dev) ;;
  prod) ENV=production ;;
  platform)
    echo "Use 'production', not 'platform'."
    exit 1
    ;;
  *)
    echo "Unknown environment: ${1:-}"
    echo "Usage: ./scripts/deploy-primary.sh [production|dev]"
    exit 1
    ;;
esac

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VAR_FILE="$REPO_ROOT/infrastructure/terraform/environments/variables/${ENV}.tfvars"

if [ ! -f "$VAR_FILE" ]; then
  echo "Variable file not found: $VAR_FILE"
  echo "Copy the example: cp infrastructure/terraform/environments/variables/${ENV}.tfvars.example $VAR_FILE"
  exit 1
fi

case "$ENV" in
  production) BACKEND_CONFIG="$REPO_ROOT/infrastructure/terraform/environments/backends/us-east-1-production.hcl" ;;
  dev)        BACKEND_CONFIG="$REPO_ROOT/infrastructure/terraform/environments/backends/us-east-1-dev.hcl" ;;
esac

echo "Environment: $ENV"
echo "Variables:   ${ENV}.tfvars"
echo "State key:   $(grep -E '^key' "$BACKEND_CONFIG" | sed 's/key = "//;s/"//')"
echo ""

cd "$REPO_ROOT/infrastructure/terraform/environments/us-east-1"
terraform init -reconfigure -backend-config="$BACKEND_CONFIG"
terraform plan -var-file="$VAR_FILE" -out=tfplan
terraform apply tfplan
