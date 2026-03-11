#!/bin/bash

# Run grammar tests for all grammars. Builds format CLI once, then tests each grammar.

set -eu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# shellcheck source=scripts/timing-lib.sh
source "$SCRIPT_DIR/timing-lib.sh"

step "Building format CLI"
pnpm build:format-cli

export SKIP_FORMAT_BUILD=1

for g in fallout-ssl weidu-baf weidu-d weidu-tp2; do
    step "Testing grammar: $g"
    "$SCRIPT_DIR/test-grammar.sh" "$g"
done

timing_summary "All grammar tests passed"
