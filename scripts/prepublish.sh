#!/bin/bash

set -e

# Full production build for VS Code marketplace publishing.
pnpm build:grammar
pnpm build:base:client --minify
pnpm build:ts-plugin --minify
pnpm build:base:server --minify
pnpm build:base:webviews --minify
