#!/bin/bash

# Build TypeScript Language Service Plugin for .td files.
# Installs as a local node_modules package so tsserver can load it.
# Forwards args (--sourcemap, --minify) to esbuild.

set -e

mkdir -p node_modules/bgforge-td-plugin
echo '{"name":"bgforge-td-plugin","main":"index.js"}' > node_modules/bgforge-td-plugin/package.json

esbuild ./client/src/td-plugin.ts \
  --bundle \
  --outfile=node_modules/bgforge-td-plugin/index.js \
  --format=cjs \
  --platform=node \
  "$@"
