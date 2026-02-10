#!/bin/bash

set -e

# Build binary .pro file viewer CLI bundle.
esbuild ./cli/bin/src/cli.ts \
  --bundle \
  --outfile=cli/bin/out/bin-cli.js \
  --format=cjs \
  --platform=node \
  --sourcemap
