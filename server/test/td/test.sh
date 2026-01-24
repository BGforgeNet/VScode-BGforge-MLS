#!/bin/bash

# TD transpiler integration tests.
# Compares output of transpile-cli against expected .d files.
# Verifies output parses with weidu-d grammar.

set -e

cd "$(dirname "$0")"
ROOT="$(cd ../../../ && pwd)"

CLI="$ROOT/cli/transpile/out/transpile-cli.js"
GRAMMAR_DIR="$ROOT/grammars/weidu-d"
TREE_SITTER="$ROOT/node_modules/.bin/tree-sitter"

fail=0
pass=0

for sample in samples/*.td; do
    name=$(basename "$sample" .td)
    expected="samples-expected/${name}.d"

    if [[ ! -f "$expected" ]]; then
        echo "SKIP: $name (no expected file)"
        continue
    fi

    actual=".tmp-${name}.d"
    node --no-warnings "$CLI" "$sample" > "$actual"

    # Check output matches expected
    if ! diff -q "$expected" "$actual" > /dev/null 2>&1; then
        echo "FAIL: $name (output mismatch)"
        diff "$expected" "$actual" || true
        fail=$((fail + 1))
        rm -f "$actual"
        continue
    fi

    # Check output parses with weidu-d grammar
    actual_abs="$(pwd)/$actual"
    if ! (cd "$GRAMMAR_DIR" && "$TREE_SITTER" parse "$actual_abs" > /dev/null 2>&1); then
        echo "FAIL: $name (grammar parse error)"
        (cd "$GRAMMAR_DIR" && "$TREE_SITTER" parse "$actual_abs" 2>&1 | tail -5)
        fail=$((fail + 1))
        rm -f "$actual"
        continue
    fi

    echo "PASS: $name"
    pass=$((pass + 1))
    rm -f "$actual"
done

echo ""
echo "TD tests: $pass passed, $fail failed"

if [[ $fail -gt 0 ]]; then
    exit 1
fi
