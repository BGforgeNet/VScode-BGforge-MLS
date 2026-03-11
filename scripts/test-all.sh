#!/bin/bash

# Run ALL tests: main suite + grammars + format-samples + transpile-external + e2e.
# After the main suite builds CLIs, the remaining test suites run in parallel.

set -eu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

# shellcheck source=scripts/timing-lib.sh
source "$SCRIPT_DIR/timing-lib.sh"

LOG_DIR="$ROOT_DIR/tmp/test-all-logs"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

# shellcheck source=scripts/parallel-lib.sh
source "$SCRIPT_DIR/parallel-lib.sh"

step "Main test suite"
pnpm test

# All remaining suites are independent — they only need CLIs built (done by main suite).
# Grammar tests and format-samples build format CLI themselves if missing (idempotent).
step "Extended Tests"
# Format sample tests omitted: grammar tests already include format + compare + idempotency.
parallel \
    "Grammar tests"           "pnpm test:grammars" \
    "Transpile external tests" "pnpm test:transpile-external" \
    "E2E tests"               "pnpm test:e2e"

timing_summary "All tests passed (full suite)"
