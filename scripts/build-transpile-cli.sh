#!/bin/bash

# Build standalone transpile CLI bundle (TSSL, TBAF, TD).
# --banner + --define: see build-base-server.sh for rationale.
# --alias: CLI runs as standalone node process, not in VSCode extension host,
# so use native esbuild (Go binary) instead of esbuild-wasm for ~100x faster bundling.
esbuild ./cli/transpile/src/cli.ts \
  --bundle \
  --outfile=cli/transpile/out/transpile-cli.js \
  --alias:esbuild-wasm=esbuild \
  --external:esbuild \
  --format=cjs \
  --platform=node \
  --sourcemap \
  --banner:js='var __imu=require("url").pathToFileURL(__filename).href;' \
  --define:import.meta.url=__imu
