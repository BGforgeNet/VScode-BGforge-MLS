#!/bin/bash

# Run ALL tests: main suite + grammars + format-samples + transpile-external + e2e.
# Each sub-script prints its own per-stage timing. This script adds overall timing.

set -eu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# shellcheck source=scripts/timing-lib.sh
source "$SCRIPT_DIR/timing-lib.sh"

step "Main test suite (pnpm test)"
pnpm test

step "Grammar tests"
pnpm test:grammars

step "Format sample tests"
pnpm test:format-samples

step "Transpile external tests"
pnpm test:transpile-external

step "E2E tests"
pnpm test:e2e

timing_summary "All tests passed (full suite)"
