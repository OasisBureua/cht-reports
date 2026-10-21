#!/usr/bin/env bash
exec "$(dirname "$0")/next-image-tag.sh" \
  "${1:-cht-reports-dev-service}" \
  "${2:-us-east-1}" \
  ""
