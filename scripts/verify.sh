#!/usr/bin/env bash
# Mirrors .github/workflows/pr-validation.yml
# Usage: ./scripts/verify.sh [all|backend|lambda|infra]
set -e

TARGET="${1:-all}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0

run_step() {
  local label="$1"; shift
  echo "→ $label"
  if ! "$@"; then
    echo "✗ $label FAILED"
    fail=1
  fi
}

if [ "$TARGET" = "all" ] || [ "$TARGET" = "backend" ]; then
  if [ -d "$REPO_ROOT/backend" ]; then
    cd "$REPO_ROOT/backend"
    if [ -f package-lock.json ]; then
      run_step "backend: npm test" npm test --silent
      run_step "backend: nest build" npm run build --silent
    else
      echo "→ backend: skip (run npm install first)"
    fi
  fi
fi

if [ "$TARGET" = "all" ] || [ "$TARGET" = "lambda" ]; then
  if [ -d "$REPO_ROOT/lambdas/generator" ]; then
    cd "$REPO_ROOT/lambdas/generator"
    run_step "lambda: pytest" python3 -m pytest tests
  fi
fi

if [ "$TARGET" = "all" ] || [ "$TARGET" = "infra" ]; then
  if command -v terraform >/dev/null 2>&1; then
    cd "$REPO_ROOT/infrastructure/terraform/environments/us-east-1"
    run_step "terraform init (backend=false)" terraform init -backend=false
    run_step "terraform validate" terraform validate
  else
    echo "→ infra: skip (terraform not installed)"
  fi
fi

cd "$REPO_ROOT"
staged_envs=$(git diff --cached --name-only 2>/dev/null | grep -E '(^|/)\.env(\..*)?$' || true)
if [ -n "$staged_envs" ]; then
  echo "✗ Refusing to commit .env files:"
  echo "$staged_envs"
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo ""
  echo "✗ verify FAILED, fix the issues above before pushing."
  exit 1
fi

echo ""
echo "✓ verify passed."
