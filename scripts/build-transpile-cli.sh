#!/bin/bash

set -e

# Build standalone transpile CLI bundle (TSSL, TBAF, TD).
# --banner + --define: see build-base-server.sh for rationale.
esbuild ./cli/transpile/src/cli.ts \
  --bundle \
  --outfile=cli/transpile/out/transpile-cli.js \
  --external:esbuild \
  --external:esbuild-wasm \
  --format=cjs \
  --platform=node \
  --sourcemap \
  --banner:js='var __imu=require("url").pathToFileURL(__filename).href;' \
  --define:import.meta.url=__imu
