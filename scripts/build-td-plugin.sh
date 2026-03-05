#!/bin/bash

# Build TypeScript Language Service Plugin for .td files.
# For VSCode: installs as a local node_modules package so tsserver can load it.
# For npm: bundled into @bgforge/mls-server by publish-server.sh.
# Source lives in plugins/td-plugin/src/.

set -e

mkdir -p node_modules/bgforge-td-plugin
echo '{"name":"bgforge-td-plugin","main":"index.js"}' > node_modules/bgforge-td-plugin/package.json

esbuild ./plugins/td-plugin/src/index.ts \
  --bundle \
  --outfile=node_modules/bgforge-td-plugin/index.js \
  --format=cjs \
  --platform=node \
  "$@"
