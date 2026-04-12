#!/bin/bash

set -e

# Build standalone format CLI bundle.
# See esbuild-lib.sh for rationale on the --banner/--define __imu shim.

# shellcheck source=scripts/esbuild-lib.sh
source "$(dirname "$0")/esbuild-lib.sh"

esbuild ./cli/format/src/cli.ts \
  --bundle \
  --outfile=cli/format/out/format-cli.js \
  --format=cjs \
  --platform=node \
  --sourcemap \
  --banner:js="$imu_banner" \
  "$imu_define"

# Copy tree-sitter WASM files
copy_wasm_to cli/format/out
