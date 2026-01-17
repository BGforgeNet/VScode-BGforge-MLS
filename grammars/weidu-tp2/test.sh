#!/bin/bash

# Test tree-sitter WeiDU TP2 grammar - runs all quality checks

set -eu -o pipefail

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
while IFS= read -r -d '' f; do
    # tree-sitter parse outputs AST to stdout, stats+errors on last line
    # Capture full output, then check last line for MISSING/ERROR markers
    full_output=$("$TS" parse "$f" 2>&1) || true
    result=$(echo "$full_output" | tail -1)
    if echo "$result" | grep -qE "(ERROR|MISSING)"; then
        echo "PARSE ERROR: $f"
        echo "  $result"
        exit 1
    fi
done < <(find -L test/samples -type f \( -name "*.tp2" -o -name "*.tpa" -o -name "*.tph" -o -name "*.tpp" \) -print0)
echo "All samples parsed successfully"

echo ""
echo "=== Formatting samples (validation only) ==="
while IFS= read -r -d '' f; do
    # Run formatter without --save, capture stderr
    # Path relative to ROOT_DIR since pnpm runs from there
    if ! result=$(pnpm -s --dir "$ROOT_DIR" format "grammars/weidu-tp2/$f" 2>&1 >/dev/null); then
        echo "FORMAT FAILED: $f"
        echo "$result"
        exit 1
    fi
    if echo "$result" | grep -q "Formatter bug:"; then
        echo "VALIDATION ERROR: $f"
        echo "$result" | grep "Formatter bug:"
        exit 1
    fi
done < <(find -L test/samples -type f \( -name "*.tp2" -o -name "*.tpa" -o -name "*.tph" -o -name "*.tpp" \) -print0)
echo "All samples formatted without validation errors"
