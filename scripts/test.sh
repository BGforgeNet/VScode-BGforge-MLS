#!/bin/bash

# Run all tests across the monorepo
set -eu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

_start_time=$(date +%s%3N)
_prev_time=$_start_time

step() {
    local now
    now=$(date +%s%3N)
    if [ "$_prev_time" != "$_start_time" ]; then
        echo "  ^ $(( now - _prev_time )) ms"
    fi
    _prev_time=$now
    echo ""
    echo "=== $1 ==="
}

step "Linting Shell Scripts"
pnpm lint:shell

step "Typechecking Client"
(cd client && pnpm exec tsc --noEmit)
(cd client && pnpm exec tsc --noEmit -p tsconfig.ts-plugin.json)

step "Typechecking Server"
(cd server && pnpm exec tsc --noEmit)

step "Typechecking CLI"
pnpm exec tsc --project cli/tsconfig.json

step "Running ESLint"
pnpm exec eslint 'server/src/**/*.ts' 'client/src/**/*.ts' 'cli/**/*.ts' --ignore-pattern 'cli/test' --ignore-pattern 'cli/vitest.config.ts' --no-warn-ignored --max-warnings 0

step "Running Server Unit Tests + Coverage"
(cd server && pnpm exec vitest run --coverage)

step "Running Client Unit Tests"
vitest run --config client/vitest.config.ts

step "Testing TD Samples"
./server/test/td/test.sh
./server/test/td/typecheck-samples.sh

step "Testing TBAF Samples"
./server/test/tbaf/typecheck-samples.sh

step "Checking Formatting"
(cd client && pnpm exec prettier --check "src/**/*.css" "src/**/*.html")

step "Testing CLI"
pnpm test:cli

step "Testing Binary Parser"
pnpm test:bin

step "Testing Scripts"
pnpm test:scripts

step "Linting Scripts"
pnpm lint:scripts

step "Testing External"
pnpm test:external

step "Checking for unused code (knip)"
pnpm knip

step "Checking for dead production code (knip --production)"
pnpm knip:prod

_end_time=$(date +%s%3N)
echo "  ^ $(( _end_time - _prev_time )) ms"
echo ""
echo "=== All tests passed in $(( _end_time - _start_time )) ms ==="
