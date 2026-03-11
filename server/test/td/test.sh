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

# Transpile all samples in one batch to a temp dir
tmpdir=".tmp-td-test"
rm -rf "$tmpdir"
mkdir -p "$tmpdir"

for sample in samples/*.td; do
    name=$(basename "$sample" .td)
    cp "$sample" "$tmpdir/${name}.td"
done

# Batch transpile (single node process)
node --no-warnings "$CLI" "$tmpdir" -r --save -q 2>&1

for sample in samples/*.td; do
    name=$(basename "$sample" .td)
    expected="samples-expected/${name}.d"
    actual="$tmpdir/${name}.d"

    if [[ ! -f "$expected" ]]; then
        echo "SKIP: $name (no expected file)"
        continue
    fi

    if [[ ! -f "$actual" ]]; then
        echo "FAIL: $name (no output produced)"
        fail=$((fail + 1))
        continue
    fi

    # Check output matches expected
    if ! diff -q "$expected" "$actual" > /dev/null 2>&1; then
        echo "FAIL: $name (output mismatch)"
        diff "$expected" "$actual" || true
        fail=$((fail + 1))
        continue
    fi

    # Check output parses with weidu-d grammar
    actual_abs="$(pwd)/$actual"
    if ! (cd "$GRAMMAR_DIR" && "$TREE_SITTER" parse "$actual_abs" > /dev/null 2>&1); then
        echo "FAIL: $name (grammar parse error)"
        (cd "$GRAMMAR_DIR" && "$TREE_SITTER" parse "$actual_abs" 2>&1 | tail -5)
        fail=$((fail + 1))
        continue
    fi

    echo "PASS: $name"
    pass=$((pass + 1))
done

rm -rf "$tmpdir"

echo ""
echo "TD tests: $pass passed, $fail failed"

if [[ $fail -gt 0 ]]; then
    exit 1
fi
