#!/bin/bash

# Test tree-sitter WeiDU TP2 grammar - runs all quality checks

# set -e -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
TS="$ROOT_DIR/node_modules/.bin/tree-sitter"

cd "$SCRIPT_DIR"

echo "=== Generating grammar ==="
"$TS" generate

echo ""
echo "=== Running ESLint ==="
pnpm eslint grammar.js --max-warnings 0

echo ""
echo "=== Running corpus tests ==="
"$TS" test

echo ""
echo "=== Parsing samples ==="
for f in $(find -L test/samples -type f \( -name "*.tp2" -o -name "*.tpa" -o -name "*.tph" -o -name "*.tpp" \)); do
    result=$("$TS" parse "$f" 2>&1)
    if echo "$result" | grep -q "ERROR"; then
        echo "ERROR in: $f"
        echo "$result" | grep "ERROR"
        exit 1
    fi
done
echo "All samples parsed successfully"

echo ""
echo "=== Formatting samples (validation only) ==="
for f in $(find -L test/samples -type f \( -name "*.tp2" -o -name "*.tpa" -o -name "*.tph" -o -name "*.tpp" \)); do
    # Run formatter without --save, capture stderr
    # Path relative to ROOT_DIR since pnpm runs from there
    result=$(pnpm -s --dir "$ROOT_DIR" format "grammars/weidu-tp2/$f" 2>&1 >/dev/null)
    if echo "$result" | grep -q "Formatter bug:"; then
        echo "VALIDATION ERROR: $f"
        echo "$result" | grep "Formatter bug:"
        exit 1
    fi
done
echo "All samples formatted without validation errors"
