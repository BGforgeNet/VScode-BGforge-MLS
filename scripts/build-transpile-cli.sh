#!/bin/bash

set -e

# Build standalone transpile CLI bundle (TSSL, TBAF, TD).
esbuild ./cli/transpile/src/cli.ts \
  --bundle \
  --outfile=cli/transpile/out/transpile-cli.js \
  --external:esbuild \
  --external:esbuild-wasm \
  --format=cjs \
  --platform=node \
  --sourcemap

# Patch import_meta for web-tree-sitter compatibility
# esbuild creates empty import_meta in CJS bundles, but web-tree-sitter needs import_meta.url
sed -i "s/var import_meta = {};/var import_meta = {url: require('url').pathToFileURL(__filename).href};/" \
  cli/transpile/out/transpile-cli.js
