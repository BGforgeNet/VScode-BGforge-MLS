#!/bin/bash

# Full production build for VS Code marketplace publishing.
# Builds everything needed for the VSIX with --minify (no sourcemaps).

set -e

pnpm build:grammar
pnpm build:base:client --minify
pnpm build:ts-plugin --minify
pnpm build:td-plugin --minify
pnpm build:base:server --minify
pnpm build:base:webviews --minify
