#!/bin/bash

# Build tree-sitter grammars to WASM and set up files for both production and testing.
# Builds all 4 grammars in parallel, then copies WASM files and generates type definitions.
# After building, copies WASM files to server/out/ and cli/format/out/, then creates
# symlinks in server/src/shared/ so vitest can find them via __dirname resolution.

set -eu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

# shellcheck source=scripts/timing-lib.sh
source "$SCRIPT_DIR/timing-lib.sh"

LOG_DIR="$ROOT_DIR/tmp/grammar-build-logs"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

# shellcheck source=scripts/parallel-lib.sh
source "$SCRIPT_DIR/parallel-lib.sh"

mkdir -p server/out cli/format/out

TREE_SITTER="$ROOT_DIR/node_modules/.bin/tree-sitter"

# Build all 4 grammars in parallel (generate C++ and compile to WASM)
step "Building grammar WASMs"
parallel \
    "fallout-ssl" "cd '$ROOT_DIR/grammars/fallout-ssl' && '$TREE_SITTER' generate && '$TREE_SITTER' build --wasm" \
    "weidu-baf"   "cd '$ROOT_DIR/grammars/weidu-baf'   && '$TREE_SITTER' generate && '$TREE_SITTER' build --wasm" \
    "weidu-d"     "cd '$ROOT_DIR/grammars/weidu-d'     && '$TREE_SITTER' generate && '$TREE_SITTER' build --wasm" \
    "weidu-tp2"   "cd '$ROOT_DIR/grammars/weidu-tp2'   && '$TREE_SITTER' generate && '$TREE_SITTER' build --wasm"

# Copy WASM files to server and CLI output directories (sequential — depends on all builds)
for dir in fallout-ssl weidu-baf weidu-d weidu-tp2; do
    cp "grammars/$dir"/*.wasm server/out/
    cp "grammars/$dir"/*.wasm cli/format/out/
done

# Copy web-tree-sitter runtime WASM (needed by parser-factory.ts)
cp server/node_modules/web-tree-sitter/web-tree-sitter.wasm server/out/

# Create symlinks in server/src/shared/ for vitest.
# vitest resolves __dirname to the source directory (server/src/shared/), not the
# build output (server/out/). These symlinks let parser-factory.ts find WASM files
# during testing without a full build.
for wasm in server/out/*.wasm; do
    target="server/src/shared/$(basename "$wasm")"
    ln -sf "../../out/$(basename "$wasm")" "$target"
done

# Generate SyntaxType enums for all LSP grammars in parallel.
# dts-tree-sitter is a per-grammar devDependency, not hoisted to the workspace root.
step "Generating type definitions"
parallel \
    "types:fallout-ssl" "cd '$ROOT_DIR/grammars/fallout-ssl' && ./node_modules/.bin/dts-tree-sitter . > src/tree-sitter.d.ts && cp src/tree-sitter.d.ts '$ROOT_DIR/server/src/fallout-ssl/tree-sitter.d.ts'" \
    "types:weidu-baf"   "cd '$ROOT_DIR/grammars/weidu-baf'   && ./node_modules/.bin/dts-tree-sitter . > src/tree-sitter.d.ts && cp src/tree-sitter.d.ts '$ROOT_DIR/server/src/weidu-baf/tree-sitter.d.ts'" \
    "types:weidu-d"     "cd '$ROOT_DIR/grammars/weidu-d'     && ./node_modules/.bin/dts-tree-sitter . > src/tree-sitter.d.ts && cp src/tree-sitter.d.ts '$ROOT_DIR/server/src/weidu-d/tree-sitter.d.ts'" \
    "types:weidu-tp2"   "cd '$ROOT_DIR/grammars/weidu-tp2'   && ./node_modules/.bin/dts-tree-sitter . > src/tree-sitter.d.ts && cp src/tree-sitter.d.ts '$ROOT_DIR/server/src/weidu-tp2/tree-sitter.d.ts'"

timing_summary "Grammar build complete"
