#!/bin/bash

set -xeu -o pipefail

npm install -g vsce
vsce publish
vsce package

version="$(jq -r '.version' package.json)"
githubrelease release BGforgeNet/VScode-BGforge-MLS create "v$version" --publish --name "v$version" "bgforge-mls-$version.vsix"
rm -f *.vsix

#for next release
npm update
npm -g update
