#!/bin/bash
# Test tree-sitter SSL grammar - runs all quality checks
set -xeu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$SCRIPT_DIR"

echo "=== Generating grammar ==="
tree-sitter generate

echo ""
echo "=== Running ESLint ==="
pnpm eslint grammar.js --max-warnings 0

echo ""
echo "=== Running tree-sitter unit tests ==="
tree-sitter test

echo ""
echo "=== Formatting samples ==="
rm -rf test/samples-formatted test/samples-formatted-2
mkdir -p test/samples-formatted
for f in test/samples/*.ssl; do
    pnpm -s --dir "$ROOT_DIR" format "$SCRIPT_DIR/$f" > "test/samples-formatted/$(basename "$f")" 2>&1
done

echo ""
echo "=== Comparing against expected output ==="
if diff -ru test/samples-expected test/samples-formatted; then
    echo "OK: Formatter output matches expected"
else
    echo "FAILED: Formatter output differs from expected"
    exit 1
fi

echo ""
echo "=== Checking format idempotency ==="
mkdir -p test/samples-formatted-2
for f in test/samples-formatted/*.ssl; do
    pnpm -s --dir "$ROOT_DIR" format "$SCRIPT_DIR/$f" > "test/samples-formatted-2/$(basename "$f")" 2>&1
done

if diff -ru test/samples-formatted test/samples-formatted-2; then
    echo "SUCCESS: All samples are idempotent"
else
    echo "FAILED: Files changed after re-format"
    exit 1
fi
