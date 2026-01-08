#!/bin/bash
set -e

cd grammars/fallout-ssl
pnpm exec tree-sitter generate
pnpm exec tree-sitter build --wasm
cp tree-sitter-ssl.wasm ../../server/out/

cd ../weidu-baf
pnpm exec tree-sitter generate
pnpm exec tree-sitter build --wasm
cp tree-sitter-baf.wasm ../../server/out/

cd ../weidu-d
pnpm exec tree-sitter generate
pnpm exec tree-sitter build --wasm
cp tree-sitter-weidu_d.wasm ../../server/out/
