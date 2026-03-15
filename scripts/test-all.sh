#!/bin/bash

# Run ALL tests: main suite + grammars + transpile-external.
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
# Grammar tests build format CLI themselves if missing (idempotent).
step "Extended Tests"
parallel \
    "Grammar tests"           "pnpm test:grammars" \
    "Transpile external tests" "pnpm test:transpile-external"

timing_summary "All tests passed (full suite)"
