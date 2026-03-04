#!/bin/bash

set -e

# Build server bundle
# --define replaces import.meta.url references with __imu (defined in --banner).
# web-tree-sitter needs import.meta.url to resolve WASM file paths,
# but esbuild's CJS output shims import.meta as an empty object.
# --banner + --define works reliably with --minify (unlike the old sed approach).
esbuild ./server/src/server.ts --bundle --outfile=server/out/server.js \
  --external:vscode --external:esbuild-wasm --format=cjs --platform=node \
  --banner:js='var __imu=require("url").pathToFileURL(__filename).href;' \
  --define:import.meta.url=__imu \
  "$@"

# Copy tree-sitter WASM files
cp grammars/fallout-ssl/tree-sitter-ssl.wasm server/out/
cp grammars/weidu-baf/tree-sitter-baf.wasm server/out/
cp grammars/weidu-d/tree-sitter-weidu_d.wasm server/out/
cp grammars/weidu-tp2/tree-sitter-weidu_tp2.wasm server/out/
cp server/node_modules/web-tree-sitter/web-tree-sitter.wasm server/out/

# Copy TD runtime declarations (used by the TD TypeScript plugin)
cp server/src/td/td-runtime.d.ts server/out/
