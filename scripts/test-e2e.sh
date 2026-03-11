#!/usr/bin/env bash

# Run E2E tests using @vscode/test-electron.

set -eu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# shellcheck source=scripts/timing-lib.sh
source "$SCRIPT_DIR/timing-lib.sh"

step "Running E2E tests"

CODE_TESTS_PATH="$(pwd)/client/out/test"
export CODE_TESTS_PATH
CODE_TESTS_WORKSPACE="$(pwd)/client/testFixture"
export CODE_TESTS_WORKSPACE

xvfb-run -a node "$(pwd)/client/out/test/runTest"

timing_summary "E2E tests passed"
