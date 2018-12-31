#!/bin/bash

set -xeu -o pipefail

npm install -g vsce
vsce publish
vsce package

version="$(jq -r '.version' package.json)"
githubrelease release BGforgeNet/vscode-bgforge-mls create "v$version" --publish --name "v$version" "bgforge-mls-$version.vsix"

#for next release
npm update
npm -g update
