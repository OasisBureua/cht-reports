#!/usr/bin/env bash
# Invoke the generator live alias (requires AWS creds).
# Usage: ./scripts/smoke.sh [dev|production]
set -euo pipefail

ENV="${1:-dev}"
REGION="${2:-us-east-1}"

case "$ENV" in
  dev)        FUNCTION="cht-reports-dev-generator" ;;
  production|prod) FUNCTION="cht-reports-prod-generator" ;;
  *)
    echo "Usage: ./scripts/smoke.sh [dev|production]"
    exit 1
    ;;
esac

OUT="$(mktemp)"
trap 'rm -f "$OUT"' EXIT

aws lambda invoke \
  --function-name "${FUNCTION}:live" \
  --region "$REGION" \
  --cli-binary-format raw-in-base64-out \
  --payload '{"source":"smoke"}' \
  "$OUT" >/dev/null

python3 - "$OUT" <<'PY'
import json, sys
path = sys.argv[1]
with open(path) as f:
    data = json.load(f)
print(json.dumps(data, indent=2))
if data.get("statusCode") != 200:
    raise SystemExit("smoke invoke failed")
PY

echo "Smoke invoke of ${FUNCTION}:live passed."
