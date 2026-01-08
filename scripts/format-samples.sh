#!/bin/bash

# Regenerate expected formatter output for all grammars
set -eu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

for samples_dir in grammars/*/test/samples; do
    grammar_dir=$(dirname "$samples_dir")
    expected_dir="$grammar_dir/samples-expected"

    echo "=== Regenerating $expected_dir ==="
    rm -rf "$expected_dir"
    mkdir -p "$expected_dir"

    for f in "$samples_dir"/*; do
        pnpm -s format "$f" > "$expected_dir/$(basename "$f")" 2>&1
    done
done

echo "Done"
