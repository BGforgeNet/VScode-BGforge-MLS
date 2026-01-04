#!/bin/bash

# Test binary proto file parser
set -eu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLIENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$CLIENT_DIR"

# Test valid files (exclude bad/ directory)
for f in testFixture/proto/critters/*.pro \
         testFixture/proto/items/*.pro \
         testFixture/proto/misc/*.pro \
         testFixture/proto/scenery/*.pro \
         testFixture/proto/tiles/*.pro \
         testFixture/proto/walls/*.pro; do
    pnpx tsx src/bin-cli.ts "$f" --check "$@"
done

# Test bad files - expect errors
for f in testFixture/proto/bad/*.pro; do
    errorFile="${f%.pro}.error"
    if [ ! -f "$errorFile" ]; then
        echo "Missing error file: $errorFile"
        exit 1
    fi

    expected=$(cat "$errorFile")
    # Use || true because tsx exits non-zero for bad files (expected)
    actual=$(pnpx tsx src/bin-cli.ts "$f" 2>&1 || true)
    actual=$(echo "$actual" | tail -1 | sed 's/^  //')

    if [ "$actual" != "$expected" ]; then
        echo "FAIL: $f"
        echo "  Expected: $expected"
        echo "  Got: $actual"
        exit 1
    fi
    echo "OK (error): $f"
done
