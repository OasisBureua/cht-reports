#!/usr/bin/env bash
exec "$(dirname "$0")/next-image-tag.sh" \
  "${1:-cht-reports-prod-backend}" \
  "${2:-us-east-1}" \
  "v" \
  "${3:-cht-reports-prod-generator}"
