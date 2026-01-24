#!/bin/bash

# Test client - typecheck and formatting
set -eu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLIENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$CLIENT_DIR"

echo "=== Typechecking client ==="
pnpm exec tsc --noEmit

echo ""
echo "=== Checking formatting ==="
pnpm exec prettier --check "src/**/*.css" "src/**/*.html"

echo ""
echo "SUCCESS: All client tests passed"
