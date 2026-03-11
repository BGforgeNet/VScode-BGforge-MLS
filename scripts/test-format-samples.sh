#!/bin/bash

# Test formatter output against expected results for all grammars.
# Uses batch formatting (single process per grammar) instead of per-file spawning.

set -eu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

# shellcheck source=scripts/timing-lib.sh
source "$SCRIPT_DIR/timing-lib.sh"

step "Building format CLI"
pnpm build:format-cli

FAILED=0

# --- All grammars: copy, format in-place, compare, check idempotency ---
for grammar_dir in grammars/fallout-ssl grammars/weidu-baf grammars/weidu-d grammars/weidu-tp2; do
    lang=$(basename "$grammar_dir")
    samples_dir="$grammar_dir/test/samples"
    expected_dir="$grammar_dir/test/samples-expected"
    formatted_dir="$grammar_dir/test/samples-formatted"

    step "$lang: Formatting samples"
    rm -rf "$formatted_dir"
    cp -r "$samples_dir" "$formatted_dir"
    # Remove non-matching files (e.g. .2da, .itm companions in tp2 samples)
    case "$lang" in
        fallout-ssl) find "$formatted_dir" -type f ! -name "*.ssl" -delete ;;
        weidu-baf)   find "$formatted_dir" -type f ! -name "*.baf" -delete ;;
        weidu-d)     find "$formatted_dir" -type f ! -name "*.d" -delete ;;
        weidu-tp2)   find "$formatted_dir" -type f ! \( -name "*.tp2" -o -name "*.tpa" -o -name "*.tph" -o -name "*.tpp" \) -delete ;;
    esac
    find "$formatted_dir" -type d -empty -delete 2>/dev/null || true
    pnpm -s format "$formatted_dir" -r --save -q

    step "$lang: Comparing against expected"
    if ! diff -ru "$expected_dir" "$formatted_dir"; then
        echo "FAILED: $lang formatter output differs"
        FAILED=1
        continue
    fi

    step "$lang: Checking idempotency"
    if ! pnpm -s format "$formatted_dir" -r --check -q; then
        echo "FAILED: $lang format not idempotent"
        FAILED=1
    fi
done

if [ $FAILED -ne 0 ]; then
    echo ""
    echo "FAILED: Some format tests failed"
    exit 1
fi

timing_summary "All format tests passed"
