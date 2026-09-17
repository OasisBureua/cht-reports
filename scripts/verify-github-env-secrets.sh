#!/usr/bin/env bash
# Fail fast when required GitHub Environment secrets are missing/empty.
# Usage: verify-github-env-secrets.sh [development|production]
set -euo pipefail

ENV_LABEL="${1:-development}"
echo "Verifying GitHub secrets for: $ENV_LABEL"

# AWS_ROLE_ARN is consumed by aws-actions/configure-aws-credentials, not this script.
# Add require() calls here as TF_VAR_* secrets are introduced.

echo "No additional GitHub Environment secrets are required for the scaffold."
echo "Ensure AWS_ROLE_ARN is set on Environment '$ENV_LABEL' (see docs/engineering/github-oidc.md)."
echo "Required GitHub secrets check passed for $ENV_LABEL"
