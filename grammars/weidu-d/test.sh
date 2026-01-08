#!/bin/bash
# Test tree-sitter WeiDU D grammar - runs all quality checks
set -xeu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$SCRIPT_DIR"

echo "=== Generating grammar ==="
tree-sitter generate

echo ""
echo "=== Running ESLint ==="
pnpm eslint grammar.js --max-warnings 0

echo ""
echo "=== Setting up external samples ==="
"$ROOT_DIR/scripts/setup-external-samples.sh"

echo ""
echo "=== Parsing samples ==="
for f in test/samples/*.d; do
    echo "Parsing: $f"
    tree-sitter parse "$f" > /dev/null
done

echo ""
echo "=== Formatting samples ==="
rm -rf test/samples-formatted test/samples-formatted-2
mkdir -p test/samples-formatted
for f in test/samples/*.d; do
    # Skip external ascension samples (only used for parsing tests)
    if [[ $(basename "$f") == ascension_* ]]; then
        continue
    fi
    pnpm -s --dir "$ROOT_DIR" format "$SCRIPT_DIR/$f" > "test/samples-formatted/$(basename "$f")" 2>&1
done

echo ""
echo "=== Comparing against expected output ==="
if diff -ru test/samples-expected test/samples-formatted; then
    echo "OK: Formatter output matches expected"
else
    echo "FAILED: Formatter output differs from expected"
    exit 1
fi

echo ""
echo "=== Checking format idempotency ==="
mkdir -p test/samples-formatted-2
for f in test/samples-formatted/*.d; do
    # Skip external ascension samples
    if [[ $(basename "$f") == ascension_* ]]; then
        continue
    fi
    pnpm -s --dir "$ROOT_DIR" format "$SCRIPT_DIR/$f" > "test/samples-formatted-2/$(basename "$f")" 2>&1
done

if diff -ru test/samples-formatted test/samples-formatted-2; then
    echo "SUCCESS: All samples are idempotent"
else
    echo "FAILED: Files changed after re-format"
    exit 1
fi
