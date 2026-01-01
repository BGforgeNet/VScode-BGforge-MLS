#!/bin/bash
set -e

cd grammars/fallout-ssl
pnpm exec tree-sitter generate
pnpm exec tree-sitter build --wasm
