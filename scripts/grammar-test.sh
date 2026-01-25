#!/bin/bash

# Test a single grammar: generate, lint, corpus, parse, format, compare, idempotency.
# Usage: ./scripts/grammar-test.sh <grammar-name>

set -eu -o pipefail

GRAMMAR_NAME="${1:?Usage: $0 <grammar-name>}"

case "$GRAMMAR_NAME" in
    fallout-ssl) SAMPLE_EXTS=(-name "*.ssl") ;;
    weidu-baf)   SAMPLE_EXTS=(-name "*.baf") ;;
    weidu-d)     SAMPLE_EXTS=(-name "*.d") ;;
    weidu-tp2)   SAMPLE_EXTS=(-name "*.tp2" -o -name "*.tpa" -o -name "*.tph" -o -name "*.tpp") ;;
    *) echo "Unknown grammar: $GRAMMAR_NAME"; exit 1 ;;
esac

source "$(dirname "$0")/grammar-test-lib.sh"

grammar_generate
grammar_lint
grammar_corpus

# Grammar-specific hooks
if [[ "$GRAMMAR_NAME" == "weidu-d" ]]; then
    echo ""
    echo "=== Setting up external samples ==="
    "$ROOT_DIR/scripts/setup-external-samples.sh"
fi

grammar_parse
grammar_build_format
grammar_format
grammar_compare
grammar_idempotency
grammar_success
