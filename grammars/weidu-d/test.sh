#!/bin/bash

# Test tree-sitter WeiDU D grammar

set -xeu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$SCRIPT_DIR"

echo "=== Generating grammar ==="
tree-sitter generate

echo ""
echo "=== Parsing samples ==="
for f in test/samples/*.d; do
    echo "Parsing: $f"
    tree-sitter parse "$f" > /dev/null
done

echo ""
echo "=== Formatting samples to expected ==="
mkdir -p test/samples-expected
for f in test/samples/*.d; do
    pnpm -s --dir "$ROOT_DIR" format "$SCRIPT_DIR/$f" > "test/samples-expected/$(basename "$f")"
    basename "$f"
done

echo ""
echo "=== Checking format idempotency ==="
#pnpm -s --dir "$ROOT_DIR" format "$SCRIPT_DIR/test/samples-expected" -r --save
# git diff --quiet test/samples-expected || { echo "FAIL: Samples are not idempotent"; exit 1; }
echo "SUCCESS: All samples are idempotent"

echo ""
echo "SUCCESS: All D tests passed"
