#!/bin/bash
# Test tree-sitter SSL grammar against script files

cd "$(dirname "$0")"
tree-sitter generate 2>&1

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
