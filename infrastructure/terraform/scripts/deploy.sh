#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-us-east-1}"
ACTION="${2:-plan}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TF_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "CHT Reports Terraform Deployment"
echo "Environment: $ENVIRONMENT"
echo "Action: $ACTION"
echo ""

cd "${TF_ROOT}/environments/${ENVIRONMENT}"

VAR_FILE="../variables/production.tfvars"
TF_VAR_ARGS=()
if [[ -f "$VAR_FILE" ]]; then
  TF_VAR_ARGS=(-var-file="${VAR_FILE}")
  echo "Using var file: ${VAR_FILE}"
else
  echo "No ${VAR_FILE}: set variables via other *.tfvars, -var, or TF_VAR_* (init/plan may fail if required vars are missing)."
fi
echo ""

case "$ACTION" in
  init)
    echo "Initializing Terraform..."
    terraform init
    ;;
  plan)
    echo "Planning Terraform changes..."
    terraform plan "${TF_VAR_ARGS[@]}"
    ;;
  apply)
    echo "Applying Terraform changes..."
    terraform apply "${TF_VAR_ARGS[@]}"
    ;;
  destroy)
    echo "Destroying infrastructure..."
    read -r -p "Are you sure? (yes/no): " confirm
    if [[ "$confirm" == "yes" ]]; then
      terraform destroy "${TF_VAR_ARGS[@]}"
    else
      echo "Aborted."
    fi
    ;;
  *)
    echo "Unknown action: $ACTION"
    echo "Usage: ./deploy.sh [environment] [init|plan|apply|destroy]"
    echo "Example: ./deploy.sh us-east-1 plan"
    exit 1
    ;;
esac

echo ""
echo "Done."
