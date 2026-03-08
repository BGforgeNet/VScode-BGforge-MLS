#!/bin/bash

# Build and publish the standalone LSP server package to npm.
# Usage: ./scripts/publish-server.sh [--dry-run]
# Set SKIP_BUILD=1 to skip grammar/data/server build (CI uses this).
#
# Prerequisites:
#   - pnpm install
#   - pnpm login (or NPM_TOKEN set)
#   - @bgforge npm org must exist

set -eu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

if [ "${SKIP_BUILD:-}" != "1" ]; then
    echo "=== Building grammars ==="
    pnpm build:grammar

    echo ""
    echo "=== Generating static data ==="
    pnpm generate-data

    echo ""
    echo "=== Building server ==="
    pnpm build:base:server --minify
fi

# TS plugins: normal build puts them in node_modules/, npm package needs them in server/out/
echo "=== Building TS plugins into server/out/ ==="
pnpm exec esbuild ./plugins/tssl-plugin/src/index.ts \
  --bundle --outfile=server/out/tssl-plugin.js --format=cjs --platform=node --minify
pnpm exec esbuild ./plugins/td-plugin/src/index.ts \
  --bundle --outfile=server/out/td-plugin.js --format=cjs --platform=node --minify

echo ""
echo "=== Publishing @bgforge/mls-server ==="
cd server

# --provenance adds signed attestation, requires GitHub Actions OIDC (id-token: write)
provenance=""
if [ -n "${GITHUB_ACTIONS:-}" ]; then
    provenance="--provenance"
fi

# --no-git-checks: GitHub Actions checks out a detached HEAD, which breaks pnpm's publish-branch validation.
# We check for clean working tree ourselves; branch validation is redundant in CI.
if [ -n "$(git status --porcelain)" ]; then
    echo "Error: Git working tree is not clean. Aborting publish."
    git status --short
    exit 1
fi

pnpm publish --access public --no-git-checks $provenance "$@"
