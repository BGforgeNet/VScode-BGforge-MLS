#!/bin/bash

# Shared library for grammar test scripts.
# Source this after setting GRAMMAR_NAME and SAMPLE_EXTS.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TS="$ROOT_DIR/node_modules/.bin/tree-sitter"
GRAMMAR_DIR="$ROOT_DIR/grammars/$GRAMMAR_NAME"

cd "$GRAMMAR_DIR" || exit 1

find_samples() {
    find "$1" -type f \( "${SAMPLE_EXTS[@]}" \) -print0
}

grammar_generate() {
    echo "=== Generating grammar ==="
    "$TS" generate
}

grammar_lint() {
    echo ""
    echo "=== Running ESLint ==="
    pnpm eslint grammar.js --max-warnings 0
}

grammar_corpus() {
    echo ""
    echo "=== Running corpus tests ==="
    "$TS" test
}

grammar_highlight() {
    # Highlight query validation has two parts:
    #
    # 1. Assertion tests in test/highlight/ — validated by `tree-sitter test`
    #    in grammar_corpus(). These verify that specific source positions get
    #    the expected capture names. This is the primary correctness check.
    #
    # 2. `tree-sitter highlight --check` — validates capture names against
    #    tree-sitter's built-in list. Skipped because:
    #    a) It requires tree-sitter-* directory naming for CLI auto-discovery,
    #       but our grammars use domain names (weidu-baf, fallout-ssl, etc.).
    #       Only the CLI cares about this — editors (Neovim, Helix, Zed, Emacs)
    #       discover grammars through their own config, not directory names.
    #    b) Its built-in list is very conservative and doesn't include
    #       Neovim-convention captures (keyword.conditional, function.builtin,
    #       function.call, string.special, etc.) that are widely supported by
    #       all editors. Every capture we use would produce a warning.
    #
    # So this step only checks that highlights.scm exists as a smoke test.
    if [[ ! -f "$GRAMMAR_DIR/queries/highlights.scm" ]]; then
        echo ""
        echo "=== Skipping highlight validation (no queries/highlights.scm) ==="
        return
    fi
    echo ""
    echo "=== Validating highlight captures ==="
}

grammar_parse() {
    echo ""
    echo "=== Parsing samples ==="
    while IFS= read -r -d '' f; do
        full_output=$("$TS" parse "$f" 2>&1) || true
        result=$(echo "$full_output" | tail -1)
        if echo "$result" | grep -qE "(ERROR|MISSING)"; then
            echo "PARSE ERROR: $f"
            echo "  $result"
            exit 1
        fi
    done < <(find_samples test/samples)
}

grammar_build_format() {
    if [[ "${SKIP_FORMAT_BUILD:-}" == "1" ]]; then
        return
    fi
    echo ""
    echo "=== Building format CLI ==="
    (cd "$ROOT_DIR" && pnpm build:format-cli)
}

grammar_format() {
    echo ""
    echo "=== Formatting samples ==="
    rm -rf test/samples-formatted test/samples-formatted-2
    while IFS= read -r -d '' f; do
        rel="${f#test/samples/}"
        mkdir -p "test/samples-formatted/$(dirname "$rel")"
        pnpm -s --dir "$ROOT_DIR" format "grammars/$GRAMMAR_NAME/$f" > "test/samples-formatted/$rel" \
            || { echo "FORMAT FAILED: $f"; exit 1; }
    done < <(find_samples test/samples)
}

grammar_compare() {
    echo ""
    echo "=== Comparing against expected output ==="
    if ! diff -ru test/samples-expected test/samples-formatted; then
        echo "FAILED: Formatter output differs from expected"
        exit 1
    fi
}

grammar_idempotency() {
    echo ""
    echo "=== Checking format idempotency ==="
    while IFS= read -r -d '' f; do
        rel="${f#test/samples-formatted/}"
        mkdir -p "test/samples-formatted-2/$(dirname "$rel")"
        pnpm -s --dir "$ROOT_DIR" format "grammars/$GRAMMAR_NAME/$f" > "test/samples-formatted-2/$rel" \
            || { echo "FORMAT FAILED: $f"; exit 1; }
    done < <(find_samples test/samples-formatted)
    if ! diff -ru test/samples-formatted test/samples-formatted-2; then
        echo "FAILED: Files changed after re-format"
        exit 1
    fi
}

grammar_regenerate_expected() {
    echo ""
    echo "=== Regenerating expected output ==="
    rm -rf test/samples-expected
    while IFS= read -r -d '' f; do
        rel="${f#test/samples/}"
        mkdir -p "test/samples-expected/$(dirname "$rel")"
        pnpm -s --dir "$ROOT_DIR" format "grammars/$GRAMMAR_NAME/$f" > "test/samples-expected/$rel" \
            || { echo "FORMAT FAILED: $f"; exit 1; }
    done < <(find_samples test/samples)
    echo "Done: $(find test/samples-expected -type f | wc -l) files regenerated"
}

grammar_success() {
    echo ""
    echo "SUCCESS: $GRAMMAR_NAME"
}
