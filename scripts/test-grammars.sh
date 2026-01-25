#!/bin/bash

# Run grammar tests for all grammars. Builds format CLI once, then tests each grammar.

set -eu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Building format CLI ==="
pnpm build:format-cli

export SKIP_FORMAT_BUILD=1

for g in fallout-ssl weidu-baf weidu-d weidu-tp2; do
    "$SCRIPT_DIR/grammar-test.sh" "$g"
done
