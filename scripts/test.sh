#!/bin/bash

# Run all tests across the monorepo.
# Uses parallel execution for independent stages to minimize wall time.
# Each parallel job logs to tmp/test-logs/ — silent on success, full output on failure.
set -eu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

# shellcheck source=scripts/timing-lib.sh
source "$SCRIPT_DIR/timing-lib.sh"

LOG_DIR="$ROOT_DIR/tmp/test-logs"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

# shellcheck source=scripts/parallel-lib.sh
source "$SCRIPT_DIR/parallel-lib.sh"

step "Resetting External Repos"
"$SCRIPT_DIR/reset-external.sh"

# --- Phase 1: Static analysis (all independent, run in parallel) ---
step "Static Analysis"
parallel \
    "Shell lint"       "pnpm lint:shell" \
    "Typecheck client" "(cd client && pnpm exec tsc --noEmit)" \
    "Typecheck plugins" "(cd plugins/tssl-plugin && pnpm exec tsc --noEmit) && (cd plugins/td-plugin && pnpm exec tsc --noEmit)" \
    "Typecheck server" "(cd server && pnpm exec tsc --noEmit)" \
    "Typecheck CLI"    "pnpm exec tsc --project cli/tsconfig.json" \
    "ESLint"           "pnpm exec eslint 'server/src/**/*.ts' 'client/src/**/*.ts' 'plugins/*/src/**/*.ts' 'plugins/*/test/**/*.ts' 'cli/**/*.ts' --ignore-pattern 'cli/test' --ignore-pattern 'cli/vitest.config.ts' --no-warn-ignored --max-warnings 0" \
    "Lint scripts"     "pnpm lint:scripts" \
    "Prettier check"   "(cd client && pnpm exec prettier --check 'src/**/*.css' 'src/**/*.html')"

# --- Phase 2: Unit tests (server is the bottleneck, run others alongside) ---
step "Unit Tests"
parallel \
    "Server unit tests + coverage" "(cd server && pnpm exec vitest run --coverage)" \
    "Client unit tests"            "vitest run --config client/vitest.config.ts" \
    "Plugin unit tests"            "vitest run --config plugins/tssl-plugin/vitest.config.ts && vitest run --config plugins/td-plugin/vitest.config.ts" \
    "Script tests"                 "pnpm test:scripts"

# --- Phase 3: Build + smoke ---
step "Building Server Bundle"
pnpm build:base:server

step "Running Server Smoke Test"
(cd server && pnpm exec vitest run --config vitest.smoke.config.ts)

step "Building CLIs"
pnpm build:transpile-cli
pnpm build:format-cli
pnpm build:bin-cli

# --- Phase 4: Tests that need CLI builds ---
step "Sample + CLI Tests"
parallel \
    "TD samples"      "./server/test/td/test.sh && ./server/test/td/typecheck-samples.sh" \
    "TBAF samples"    "./server/test/tbaf/typecheck-samples.sh" \
    "CLI tests"       "pnpm test:cli" \
    "Binary parser"   "pnpm test:bin"

# --- Phase 5: External + analysis ---
step "External Tests"
pnpm test:external

step "Running Integration Tests"
pnpm test:integration

step "Dead Code Analysis"
parallel \
    "Knip"      "pnpm knip" \
    "Knip prod" "pnpm knip:prod"

timing_summary "All tests passed"
