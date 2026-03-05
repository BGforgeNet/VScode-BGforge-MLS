#!/bin/bash

set -e

# Build TypeScript Language Service Plugin for .tssl files.
# For VSCode: installs as a local node_modules package so tsserver can load it.
# For npm: bundled into @bgforge/mls-server by publish-server.sh.
# Source lives in plugins/tssl-plugin/src/.
mkdir -p node_modules/bgforge-tssl-plugin
echo '{"name":"bgforge-tssl-plugin","main":"index.js"}' > node_modules/bgforge-tssl-plugin/package.json

esbuild ./plugins/tssl-plugin/src/index.ts \
  --bundle \
  --outfile=node_modules/bgforge-tssl-plugin/index.js \
  --format=cjs \
  --platform=node \
  "$@"
