#!/bin/bash
set -euo pipefail

# Usage:
#   ./infrastructure/aws-github-oidc-setup.sh development
#   ./infrastructure/aws-github-oidc-setup.sh production
#
# Creates a separate IAM role + scoped deploy policy per GitHub Environment.
# Trust is locked to that environment (not repo-wide).

ENV_ARG="${1:-}"
case "$ENV_ARG" in
  development|dev)
    GH_ENVIRONMENT="development"
    ROLE_NAME="${ROLE_NAME:-GitHubActions-CHT-Reports-Dev}"
    POLICY_NAME="${POLICY_NAME:-GitHubActions-CHT-Reports-Dev-Deploy}"
    POLICY_FILE_NAME="github-actions-deploy-policy-dev.json"
    TRUST_SUB="repo:OasisBureua/cht-reports:environment:development"
    ;;
  production|prod)
    GH_ENVIRONMENT="production"
    ROLE_NAME="${ROLE_NAME:-GitHubActions-CHT-Reports-Prod}"
    POLICY_NAME="${POLICY_NAME:-GitHubActions-CHT-Reports-Prod-Deploy}"
    POLICY_FILE_NAME="github-actions-deploy-policy-prod.json"
    TRUST_SUB="repo:OasisBureua/cht-reports:environment:production"
    ;;
  *)
    echo "Usage: $0 [development|production]"
    echo ""
    echo "  development  → role GitHubActions-CHT-Reports-Dev"
    echo "                 GitHub Environment: development"
    echo "                 ECR: cht-reports-dev-*"
    echo "  production   → role GitHubActions-CHT-Reports-Prod"
    echo "                 GitHub Environment: production"
    echo "                 ECR: cht-reports-prod-*"
    exit 1
    ;;
esac

echo "Setting up GitHub Actions OIDC for CHT Reports (${GH_ENVIRONMENT})"
echo "================================================================="
echo ""

GITHUB_ORG="${GITHUB_ORG:-OasisBureua}"
REPO_NAME="${REPO_NAME:-cht-reports}"

read -r -p "GitHub org [${GITHUB_ORG}]: " input
GITHUB_ORG="${input:-$GITHUB_ORG}"
read -r -p "Repository name [${REPO_NAME}]: " input
REPO_NAME="${input:-$REPO_NAME}"
read -r -p "IAM role name [${ROLE_NAME}]: " input
ROLE_NAME="${input:-$ROLE_NAME}"

# Rebuild sub with possibly edited org/repo
TRUST_SUB="repo:${GITHUB_ORG}/${REPO_NAME}:environment:${GH_ENVIRONMENT}"

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POLICY_FILE="${SCRIPT_DIR}/iam/${POLICY_FILE_NAME}"

if [ ! -f "$POLICY_FILE" ]; then
  echo "Missing policy file: $POLICY_FILE"
  exit 1
fi

echo ""
echo "Configuration:"
echo "  AWS Account:        $AWS_ACCOUNT_ID"
echo "  GitHub:             ${GITHUB_ORG}/${REPO_NAME}"
echo "  GitHub Environment: $GH_ENVIRONMENT"
echo "  Role:               $ROLE_NAME"
echo "  Policy:             $POLICY_NAME"
echo "  Trust sub:          $TRUST_SUB"
echo ""

cat > /tmp/github-trust-policy-cht-reports.json << TRUST
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "${TRUST_SUB}"
        }
      }
    }
  ]
}
TRUST

echo "Creating OIDC provider (no-op if it already exists)..."
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  2>/dev/null || echo "OIDC provider already exists"

echo "Creating IAM role..."
ROLE_ARN=$(aws iam create-role \
  --role-name "$ROLE_NAME" \
  --assume-role-policy-document file:///tmp/github-trust-policy-cht-reports.json \
  --query 'Role.Arn' \
  --output text 2>/dev/null || true)

if [ -z "${ROLE_ARN:-}" ]; then
  echo "Role already exists — updating trust policy..."
  aws iam update-assume-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-document file:///tmp/github-trust-policy-cht-reports.json
  ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)
fi

echo "Role: $ROLE_ARN"

echo "Creating/attaching scoped deploy policy..."
POLICY_ARN=$(aws iam create-policy \
  --policy-name "$POLICY_NAME" \
  --policy-document "file://${POLICY_FILE}" \
  --query 'Policy.Arn' \
  --output text 2>/dev/null || \
  aws iam get-policy --policy-arn "arn:aws:iam::${AWS_ACCOUNT_ID}:policy/${POLICY_NAME}" --query 'Policy.Arn' --output text)

aws iam create-policy-version \
  --policy-arn "$POLICY_ARN" \
  --policy-document "file://${POLICY_FILE}" \
  --set-as-default \
  2>/dev/null || true

aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn "$POLICY_ARN"

rm -f /tmp/github-trust-policy-cht-reports.json

echo ""
echo "OIDC setup complete for ${GH_ENVIRONMENT}."
echo ""
echo "GitHub → ${GITHUB_ORG}/${REPO_NAME} → Settings → Environments → ${GH_ENVIRONMENT}"
echo "  Secret name:  AWS_ROLE_ARN"
echo "  Secret value: ${ROLE_ARN}"
echo ""
echo "Full checklist: docs/engineering/github-oidc.md"
