#!/bin/bash

# Test server - typecheck and lint
set -eu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$SERVER_DIR"

echo "=== Typechecking server ==="
pnpm exec tsc --noEmit

echo ""
echo "=== Running ESLint ==="
pnpm exec eslint "src/**/*.ts" --max-warnings 0

echo ""
echo "=== Running unit tests ==="
pnpm test:unit

echo ""
echo "=== Testing TD samples ==="
./test/td/test.sh
./test/td/typecheck-samples.sh

echo ""
echo "=== Testing TBAF samples ==="
./test/tbaf/typecheck-samples.sh

echo ""
echo "SUCCESS: All server tests passed"
