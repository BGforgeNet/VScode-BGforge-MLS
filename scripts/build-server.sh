#!/bin/bash
set -e

# Build server bundle
esbuild ./server/src/server.ts --bundle --outfile=server/out/server.js --external:vscode --external:esbuild-wasm --format=cjs --platform=node "$@"

# Patch import_meta for web-tree-sitter compatibility
# esbuild creates empty import_meta in CJS bundles, but web-tree-sitter needs import_meta.url
sed -i "s/var import_meta = {};/var import_meta = {url: require('url').pathToFileURL(__filename).href};/" server/out/server.js

# Copy tree-sitter WASM files
cp grammars/fallout-ssl/tree-sitter-ssl.wasm server/out/
cp grammars/weidu-baf/tree-sitter-baf.wasm server/out/
cp grammars/weidu-d/tree-sitter-weidu_d.wasm server/out/
cp server/node_modules/web-tree-sitter/web-tree-sitter.wasm server/out/
