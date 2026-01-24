#!/bin/bash

# Regenerate expected formatter output for grammars with flat sample files.
# Grammars with directory-structured samples (e.g. weidu-tp2) handle
# format validation in their own test.sh instead.
set -eu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

for samples_dir in grammars/*/test/samples; do
    grammar_dir=$(dirname "$samples_dir")
    expected_dir="$grammar_dir/samples-expected"

    # Skip if samples directory contains subdirectories (not flat files)
    if find -L "$samples_dir" -mindepth 1 -maxdepth 1 -type d | grep -q .; then
        echo "=== Skipping $samples_dir (directory-structured) ==="
        continue
    fi

    echo "=== Regenerating $expected_dir ==="
    rm -rf "$expected_dir"
    mkdir -p "$expected_dir"

    for f in "$samples_dir"/*; do
        pnpm -s format "$f" > "$expected_dir/$(basename "$f")" 2>&1
    done
done

echo "Done"
