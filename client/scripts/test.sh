#!/bin/bash

# Test client - typecheck, lint, and binary parser tests
set -eu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLIENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$CLIENT_DIR"

echo "=== Typechecking client ==="
pnpm exec tsc --noEmit

echo ""
echo "=== Running ESLint ==="
pnpm exec eslint "src/**/*.ts" --max-warnings 0

echo ""
echo "=== Checking formatting ==="
pnpm exec prettier --check "src/**/*.css" "src/**/*.html"

echo ""
echo "=== Running binary parser tests ==="
./scripts/test-bin.sh

echo ""
echo "SUCCESS: All client tests passed"
