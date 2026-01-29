#!/bin/bash

set -xeu -o pipefail

pnpm install -g @vscode/vsce
vsce publish
vsce package

version="$(jq -r '.version' package.json)"
githubrelease release BGforgeNet/VScode-BGforge-MLS create "v$version" --publish --name "v$version" "bgforge-mls-$version.vsix"
rm -f ./*.vsix

#for next release
pnpm update
pnpm -g update
