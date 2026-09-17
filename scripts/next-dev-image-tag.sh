#!/usr/bin/env bash
exec "$(dirname "$0")/next-image-tag.sh" \
  "${1:-cht-reports-dev-backend}" \
  "${2:-us-east-1}" \
  "" \
  "${3:-cht-reports-dev-generator}"
