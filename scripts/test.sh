#!/bin/bash

# Run all tests across the monorepo
set -eu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

# shellcheck source=scripts/timing-lib.sh
source "$SCRIPT_DIR/timing-lib.sh"

step "Resetting External Repos"
"$SCRIPT_DIR/reset-external.sh"

step "Linting Shell Scripts"
pnpm lint:shell

step "Typechecking Client"
(cd client && pnpm exec tsc --noEmit)

step "Typechecking Plugins"
(cd plugins/tssl-plugin && pnpm exec tsc --noEmit)
(cd plugins/td-plugin && pnpm exec tsc --noEmit)

step "Typechecking Server"
(cd server && pnpm exec tsc --noEmit)

step "Typechecking CLI"
pnpm exec tsc --project cli/tsconfig.json

step "Running ESLint"
pnpm exec eslint 'server/src/**/*.ts' 'client/src/**/*.ts' 'plugins/*/src/**/*.ts' 'plugins/*/test/**/*.ts' 'cli/**/*.ts' --ignore-pattern 'cli/test' --ignore-pattern 'cli/vitest.config.ts' --no-warn-ignored --max-warnings 0

step "Running Server Unit Tests + Coverage"
(cd server && pnpm exec vitest run --coverage)

step "Running Client Unit Tests"
vitest run --config client/vitest.config.ts

step "Running Plugin Unit Tests"
vitest run --config plugins/tssl-plugin/vitest.config.ts
vitest run --config plugins/td-plugin/vitest.config.ts

step "Building Server Bundle"
pnpm build:base:server

step "Running Server Smoke Test"
(cd server && pnpm exec vitest run --config vitest.smoke.config.ts)

step "Building CLIs"
pnpm build:transpile-cli
pnpm build:format-cli
pnpm build:bin-cli

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

step "Running Integration Tests"
pnpm test:integration

step "Checking for unused code (knip)"
pnpm knip

step "Checking for dead production code (knip --production)"
pnpm knip:prod

timing_summary "All tests passed"
