#!/bin/bash

set -e

mkdir -p server/out cli/format/out

for dir in fallout-ssl weidu-baf weidu-d weidu-tp2; do
    cd "grammars/$dir"
    pnpm exec tree-sitter generate
    pnpm exec tree-sitter build --wasm
    cp *.wasm ../../server/out/
    cp *.wasm ../../cli/format/out/
    cd ../..
done

cd grammars/weidu-tp2
pnpm run generate:types
