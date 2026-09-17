#!/usr/bin/env bash
# Resolve currently applied Lambda image URIs from Terraform state.
# Usage (from TF env dir, after terraform init):
#   eval "$(../../../../scripts/ci-resolve-lambda-images-from-state.sh)"
set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >&2
  exit 1
fi

if ! command -v terraform >/dev/null 2>&1; then
  echo "terraform is required" >&2
  exit 1
fi

STATE_JSON="$(terraform show -json)"

GENERATOR_IMAGE="$(echo "$STATE_JSON" | jq -r '
  [
    ..
    | objects
    | select(
        (.type? == "aws_lambda_function")
        and ((.address? // .name? // "") | tostring | contains("generator"))
      )
    | .values.image_uri
  ]
  | map(select(type == "string" and length > 0))
  | first // empty
')"

if [ -z "${GENERATOR_IMAGE:-}" ]; then
  echo "Could not resolve generator image from Terraform state." >&2
  echo "Refusing infra-only plan that would risk rolling images back to tfvars placeholders." >&2
  exit 1
fi

echo "Resolved current Lambda images from state:" >&2
echo "  generator: ${GENERATOR_IMAGE}" >&2

printf "GENERATOR_IMAGE=%q\n" "$GENERATOR_IMAGE"
