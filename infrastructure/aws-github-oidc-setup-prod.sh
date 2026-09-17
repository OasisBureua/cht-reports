#!/bin/bash
# Wrapper: production OIDC role (GitHub Environment "production").
exec "$(dirname "$0")/aws-github-oidc-setup.sh" production "$@"
