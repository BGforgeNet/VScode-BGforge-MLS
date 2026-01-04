#!/bin/bash
# Test tree-sitter BAF grammar - runs all quality checks
set -xeu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$SCRIPT_DIR"

echo "=== Generating grammar ==="
tree-sitter generate

echo ""
echo "=== Running ESLint ==="
pnpm eslint grammar.js

echo ""
echo "=== Formatting samples ==="
for f in test/samples/*.baf; do
    pnpm -s --dir "$ROOT_DIR" format "$SCRIPT_DIR/$f" > "test/samples-expected/$(basename "$f")" 2>&1
done

echo ""
echo "=== Checking format idempotency ==="
pnpm -s --dir "$ROOT_DIR" format "$SCRIPT_DIR/test/samples-expected" -r --save 2>&1

if git diff --quiet test/samples-expected; then
    echo "SUCCESS: All samples are idempotent"
else
    echo "FAILED: Files changed after re-format"
    git diff test/samples-expected
    exit 1
fi
