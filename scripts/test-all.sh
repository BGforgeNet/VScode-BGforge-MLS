#!/bin/bash

# Run all tests across the monorepo
set -eu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

echo "=== Testing Client ==="
(cd client && pnpm test)

echo ""
echo "=== Testing Server ==="
(cd server && pnpm test)

echo ""
echo "=== Testing Grammars ==="
for g in grammars/*/test.sh; do
    echo ""
    echo "--- $(dirname "$g") ---"
    "./$g"
done

echo ""
echo "=== All tests passed ==="
