#!/usr/bin/env bash
# Compute the next semver ECR tag.
# Dev: 1.0.0 …  Platform: v1.0.0 …
#
# Usage:
#   ./scripts/next-image-tag.sh [ECR_REPO] [AWS_REGION] [PREFIX] [LAMBDA_FUNCTION]
set -euo pipefail

REPO="${1:-cht-reports-backend}"
REGION="${2:-us-east-1}"
PREFIX="${3:-}"
LAMBDA_FUNCTION="${4:-}"

if ! command -v aws >/dev/null 2>&1; then
  echo "::error::aws CLI required" >&2
  exit 1
fi

TAGS_FILE="$(mktemp)"
trap 'rm -f "$TAGS_FILE"' EXIT

if [ -n "$PREFIX" ]; then
  TAG_PATTERN="^${PREFIX}[0-9]+\\.[0-9]+\\.[0-9]+$"
else
  TAG_PATTERN='^[0-9]+\.[0-9]+\.[0-9]+$'
fi

collect_semver_tag() {
  local tag="$1"
  if [[ "$tag" =~ $TAG_PATTERN ]]; then
    echo "$tag" >> "$TAGS_FILE"
  fi
}

aws ecr describe-images \
  --repository-name "$REPO" \
  --region "$REGION" \
  --query 'imageDetails[*].imageTags[]' \
  --output text 2>/dev/null \
| tr '\t' '\n' \
| grep -E "$TAG_PATTERN" >> "$TAGS_FILE" || true

if [ -n "$LAMBDA_FUNCTION" ]; then
  DEPLOYED_IMAGE="$(aws lambda get-function \
    --function-name "$LAMBDA_FUNCTION" \
    --region "$REGION" \
    --query 'Code.ImageUri' \
    --output text 2>/dev/null || true)"
  if [ -n "$DEPLOYED_IMAGE" ] && [ "$DEPLOYED_IMAGE" != "None" ]; then
    collect_semver_tag "${DEPLOYED_IMAGE##*:}"
  fi
fi

if [ ! -s "$TAGS_FILE" ]; then
  echo "${PREFIX}1.0.0"
  exit 0
fi

LATEST="$(sort -V "$TAGS_FILE" | uniq | tail -1)"
VERSION="${LATEST#"$PREFIX"}"
IFS=. read -r major minor patch <<< "$VERSION"

patch=$((patch + 1))
if [ "$patch" -gt 9 ]; then
  patch=0
  minor=$((minor + 1))
fi
if [ "$minor" -gt 9 ]; then
  minor=0
  major=$((major + 1))
fi

echo "${PREFIX}${major}.${minor}.${patch}"
