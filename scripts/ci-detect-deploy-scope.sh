#!/usr/bin/env bash
# Set deploy_backend / deploy_lambda / deploy_infra for GitHub Actions.
#
# Usage: ci-detect-deploy-scope.sh <force_all> <backend_changed> <lambda_changed> <infra_changed>
set -euo pipefail

FORCE_ALL="${1:-false}"
BACKEND_CHANGED="${2:-false}"
LAMBDA_CHANGED="${3:-false}"
INFRA_CHANGED="${4:-false}"

DEPLOY_BACKEND=false
DEPLOY_LAMBDA=false
DEPLOY_INFRA=false

if [ "$FORCE_ALL" = "true" ]; then
  DEPLOY_BACKEND=true
  DEPLOY_LAMBDA=true
  DEPLOY_INFRA=true
else
  [ "$BACKEND_CHANGED" = "true" ] && DEPLOY_BACKEND=true
  [ "$LAMBDA_CHANGED" = "true" ] && DEPLOY_LAMBDA=true
  [ "$INFRA_CHANGED" = "true" ] && DEPLOY_INFRA=true
fi

{
  echo "deploy_backend=$DEPLOY_BACKEND"
  echo "deploy_lambda=$DEPLOY_LAMBDA"
  echo "deploy_infra=$DEPLOY_INFRA"
} >> "${GITHUB_OUTPUT:?GITHUB_OUTPUT not set}"

echo "Deploy scope: backend=$DEPLOY_BACKEND lambda=$DEPLOY_LAMBDA infra=$DEPLOY_INFRA (force_all=$FORCE_ALL)"
