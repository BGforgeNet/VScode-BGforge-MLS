#!/bin/bash

set -e

# Build standalone format CLI bundle.
# --banner + --define: see build-base-server.sh for rationale.
esbuild ./cli/format/src/cli.ts \
  --bundle \
  --outfile=cli/format/out/format-cli.js \
  --format=cjs \
  --platform=node \
  --sourcemap \
  --banner:js='var __imu=require("url").pathToFileURL(__filename).href;' \
  --define:import.meta.url=__imu

# Copy tree-sitter WASM files
cp grammars/fallout-ssl/tree-sitter-ssl.wasm \
  grammars/weidu-baf/tree-sitter-baf.wasm \
  grammars/weidu-d/tree-sitter-weidu_d.wasm \
  grammars/weidu-tp2/tree-sitter-weidu_tp2.wasm \
  server/node_modules/web-tree-sitter/web-tree-sitter.wasm \
  cli/format/out/
