#!/bin/bash

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

cd grammars/weidu-tp2 || exit 1
pnpm run generate:types
