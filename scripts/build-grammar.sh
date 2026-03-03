#!/bin/bash

# Build tree-sitter grammars to WASM and set up files for both production and testing.
# After building, copies WASM files to server/out/ and cli/format/out/, then creates
# symlinks in server/src/shared/ so vitest can find them via __dirname resolution.

set -e

mkdir -p server/out cli/format/out

for dir in fallout-ssl weidu-baf weidu-d weidu-tp2; do
    cd "grammars/$dir" || exit 1
    pnpm exec tree-sitter generate
    pnpm exec tree-sitter build --wasm
    cp ./*.wasm ../../server/out/
    cp ./*.wasm ../../cli/format/out/
    cd ../.. || exit 1
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

cd grammars/weidu-tp2 || exit 1
pnpm run generate:types
