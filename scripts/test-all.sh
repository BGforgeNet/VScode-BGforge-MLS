#!/bin/bash

# Run all tests across the monorepo
set -eu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

echo "=== Typechecking Client ==="
(cd client && pnpm exec tsc --noEmit)
(cd client && pnpm exec tsc --noEmit -p tsconfig.ts-plugin.json)

echo ""
echo "=== Typechecking Server ==="
(cd server && pnpm exec tsc --noEmit)

echo ""
echo "=== Typechecking CLI ==="
pnpm exec tsc --project cli/tsconfig.json

echo ""
echo "=== Running ESLint ==="
pnpm exec eslint 'server/src/**/*.ts' 'client/src/**/*.ts' 'cli/**/*.ts' --ignore-pattern 'cli/test' --ignore-pattern 'cli/vitest.config.ts' --no-warn-ignored --max-warnings 0

echo ""
echo "=== Running Server Unit Tests ==="
(cd server && pnpm test:unit)

echo ""
echo "=== Running Client Unit Tests ==="
vitest run --config client/vitest.config.ts

echo ""
echo "=== Testing TD Samples ==="
./server/test/td/test.sh
./server/test/td/typecheck-samples.sh

echo ""
echo "=== Testing TBAF Samples ==="
./server/test/tbaf/typecheck-samples.sh

echo ""
echo "=== Checking Formatting ==="
(cd client && pnpm exec prettier --check "src/**/*.css" "src/**/*.html")

echo ""
echo "=== Testing CLI ==="
pnpm test:cli

echo ""
echo "=== Testing Binary Parser ==="
pnpm test:bin

echo ""
echo "=== Checking for unused code (knip) ==="
pnpm knip

echo ""
echo "=== All tests passed ==="
