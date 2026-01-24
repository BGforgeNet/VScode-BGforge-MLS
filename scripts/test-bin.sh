#!/bin/bash

# Test binary proto file parser CLI
set -eu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

BIN="node cli/bin/out/bin-cli.js"

# Test valid files
for f in client/testFixture/proto/critters/*.pro \
         client/testFixture/proto/items/*.pro \
         client/testFixture/proto/misc/*.pro \
         client/testFixture/proto/scenery/*.pro \
         client/testFixture/proto/tiles/*.pro \
         client/testFixture/proto/walls/*.pro; do
    $BIN "$f" --check "$@"
done

# Test bad files - expect errors
for f in client/testFixture/proto/bad/*.pro; do
    errorFile="${f%.pro}.error"
    if [ ! -f "$errorFile" ]; then
        echo "Missing error file: $errorFile"
        exit 1
    fi

    expected=$(cat "$errorFile")
    # bin-cli exits non-zero for bad files (expected)
    actual=$($BIN "$f" 2>&1 || true)
    actual=$(echo "$actual" | tail -1 | sed 's/^  //')

    if [ "$actual" != "$expected" ]; then
        echo "FAIL: $f"
        echo "  Expected: $expected"
        echo "  Got: $actual"
        exit 1
    fi
    echo "OK (error): $f"
done

echo ""
echo "SUCCESS: All binary parser tests passed"
