#!/bin/bash

set -e

# Build TypeScript Language Service Plugin for .tssl files.
# Installs as a local node_modules package so tsserver can load it.
# Forwards args (--sourcemap, --minify) to esbuild.
mkdir -p node_modules/bgforge-tssl-plugin
echo '{"name":"bgforge-tssl-plugin","main":"index.js"}' > node_modules/bgforge-tssl-plugin/package.json

esbuild ./client/src/ts-plugin.ts \
  --bundle \
  --outfile=node_modules/bgforge-tssl-plugin/index.js \
  --format=cjs \
  --platform=node \
  "$@"
