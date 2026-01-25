#!/bin/bash

# Test formatter output against expected results for all grammars.

set -eu -o pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "=== Building format CLI ==="
pnpm build:format-cli

FAILED=0

# --- Flat-sample grammars: compare + idempotency ---
for grammar_dir in grammars/fallout-ssl grammars/weidu-baf grammars/weidu-d; do
    lang=$(basename "$grammar_dir")
    samples_dir="$grammar_dir/test/samples"
    expected_dir="$grammar_dir/test/samples-expected"
    formatted_dir="$grammar_dir/test/samples-formatted"
    formatted2_dir="$grammar_dir/test/samples-formatted-2"

    echo "=== $lang: Formatting samples ==="
    rm -rf "$formatted_dir" "$formatted2_dir"
    mkdir -p "$formatted_dir"
    for f in "$samples_dir"/*; do
        pnpm -s format "$f" > "$formatted_dir/$(basename "$f")" 2>&1
    done

    echo "=== $lang: Comparing against expected ==="
    if ! diff -ru "$expected_dir" "$formatted_dir"; then
        echo "FAILED: $lang formatter output differs"
        FAILED=1
        continue
    fi

    echo "=== $lang: Checking idempotency ==="
    mkdir -p "$formatted2_dir"
    for f in "$formatted_dir"/*; do
        pnpm -s format "$f" > "$formatted2_dir/$(basename "$f")" 2>&1
    done
    if ! diff -ru "$formatted_dir" "$formatted2_dir"; then
        echo "FAILED: $lang format not idempotent"
        FAILED=1
    fi
done

# --- TP2: compare + idempotency (has subdirectories, needs find) ---
echo ""
echo "=== weidu-tp2: Formatting samples ==="
tp2_dir="grammars/weidu-tp2"
rm -rf "$tp2_dir/test/samples-formatted" "$tp2_dir/test/samples-formatted-2"
while IFS= read -r -d '' f; do
    rel="${f#test/samples/}"
    mkdir -p "$tp2_dir/test/samples-formatted/$(dirname "$rel")"
    pnpm -s format "$tp2_dir/$f" > "$tp2_dir/test/samples-formatted/$rel"
done < <(cd "$tp2_dir" && find test/samples -type f \( -name "*.tp2" -o -name "*.tpa" -o -name "*.tph" -o -name "*.tpp" \) -print0)

echo "=== weidu-tp2: Comparing against expected ==="
if ! diff -ru "$tp2_dir/test/samples-expected" "$tp2_dir/test/samples-formatted"; then
    echo "FAILED: weidu-tp2 formatter output differs"
    FAILED=1
fi

echo "=== weidu-tp2: Checking idempotency ==="
while IFS= read -r -d '' f; do
    rel="${f#test/samples-formatted/}"
    mkdir -p "$tp2_dir/test/samples-formatted-2/$(dirname "$rel")"
    pnpm -s format "$tp2_dir/$f" > "$tp2_dir/test/samples-formatted-2/$rel"
done < <(cd "$tp2_dir" && find test/samples-formatted -type f \( -name "*.tp2" -o -name "*.tpa" -o -name "*.tph" -o -name "*.tpp" \) -print0)
if ! diff -ru "$tp2_dir/test/samples-formatted" "$tp2_dir/test/samples-formatted-2"; then
    echo "FAILED: weidu-tp2 format not idempotent"
    FAILED=1
fi

if [ $FAILED -ne 0 ]; then
    echo ""
    echo "FAILED: Some format tests failed"
    exit 1
fi
echo ""
echo "SUCCESS: All format tests passed"
