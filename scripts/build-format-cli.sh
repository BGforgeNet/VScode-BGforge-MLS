#!/bin/bash

set -e

# Build standalone format CLI bundle.
esbuild ./cli/format/src/cli.ts \
  --bundle \
  --outfile=cli/format/out/format-cli.js \
  --format=cjs \
  --platform=node \
  --sourcemap

# Patch import_meta for web-tree-sitter compatibility
# esbuild creates empty import_meta in CJS bundles, but web-tree-sitter needs import_meta.url
sed -i "s/var import_meta = {};/var import_meta = {url: require('url').pathToFileURL(__filename).href};/" \
  cli/format/out/format-cli.js

# Copy tree-sitter WASM files
cp grammars/fallout-ssl/tree-sitter-ssl.wasm \
  grammars/weidu-baf/tree-sitter-baf.wasm \
  grammars/weidu-d/tree-sitter-weidu_d.wasm \
  grammars/weidu-tp2/tree-sitter-weidu_tp2.wasm \
  server/node_modules/web-tree-sitter/web-tree-sitter.wasm \
  cli/format/out/
