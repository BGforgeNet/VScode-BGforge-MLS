#!/bin/bash

set -e

# Build binary .pro file viewer CLI bundle.
pnpm exec esbuild ./cli/bin/src/cli.ts \
  --bundle \
  --outfile=cli/bin/out/bin-cli.js \
  --format=esm \
  --platform=node \
  --sourcemap
