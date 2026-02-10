#!/bin/bash

set -e

# Build client extension bundle. Forwards args (--sourcemap, --minify, --watch) to esbuild.
esbuild ./client/src/extension.ts \
  --bundle \
  --outfile=client/out/extension.js \
  --external:vscode \
  --format=cjs \
  --platform=node \
  "$@"
