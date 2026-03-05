#!/bin/bash

# Build and publish the standalone LSP server package to npm.
# Usage: ./scripts/publish-server.sh [--dry-run]
#
# Prerequisites:
#   - pnpm install
#   - pnpm login (or NPM_TOKEN set)
#   - @bgforge npm org must exist

set -eu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

echo "=== Building grammars ==="
pnpm build:grammar

echo ""
echo "=== Generating static data ==="
pnpm generate-data

echo ""
echo "=== Building server ==="
pnpm build:base:server --minify

echo ""
echo "=== Publishing @bgforge/mls-server ==="
cd server
pnpm publish --access public "$@"
