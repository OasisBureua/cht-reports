#!/usr/bin/env bash
# Compute the next semver ECR tag.
# Dev: 1.0.0 …  Platform: v1.0.0 …
#
# Usage:
#   ./scripts/next-image-tag.sh [ECR_REPO] [AWS_REGION] [PREFIX]
set -euo pipefail

REPO="${1:-cht-reports-backend}"
REGION="${2:-us-east-1}"
PREFIX="${3:-}"

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

aws ecr describe-images \
  --repository-name "$REPO" \
  --region "$REGION" \
  --query 'imageDetails[*].imageTags[]' \
  --output text 2>/dev/null \
| tr '\t' '\n' \
| grep -E "$TAG_PATTERN" >> "$TAGS_FILE" || true

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
