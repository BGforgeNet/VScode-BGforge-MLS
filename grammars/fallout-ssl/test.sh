#!/bin/bash
# Test tree-sitter SSL grammar - runs all quality checks
set -e

cd "$(dirname "$0")"

echo "=== Generating grammar ==="
tree-sitter generate

echo ""
echo "=== Running ESLint ==="
pnpm eslint grammar.js

echo ""
echo "=== Running tree-sitter unit tests ==="
tree-sitter test

echo ""
echo "=== Checking grammar parses real SSL files ==="
DIR="${1:-/home/magi/data/work/sexydev/f2/vscode-mls/test/scripts_src}"

success=0
fail=0
failed_files=()

for f in $(find -L "$DIR" -name "*.ssl" 2>/dev/null); do
    output=$(tree-sitter parse "$f" 2>&1)
    if echo "$output" | grep -qE "ERROR|MISSING"; then
        fail=$((fail+1))
        error=$(echo "$output" | grep -oE "(ERROR|MISSING)[^)]*\)" | head -1)
        failed_files+=("$(basename "$f"): $error")
    else
        success=$((success+1))
    fi
done

echo "Success: $success"
echo "Failed: $fail"

if [ ${#failed_files[@]} -gt 0 ]; then
    echo ""
    echo "Failed files:"
    for f in "${failed_files[@]}"; do
        echo "  $f"
    done
fi
