#!/bin/bash

set -xeu -o pipefail

# launch from root repo dir

external="external/fallout"
sfall_repo="https://github.com/BGforgeNet/sfall.git"
sfall_dir="sfall"
sfall_file="server/data/fallout-ssl-sfall.yml"
highlight_file="syntaxes/fallout-ssl.tmLanguage.yml"

if [ ! -d "$external" ]; then
    mkdir "$external"
fi

# sfall
pushd .
cd "$external"
if [ ! -d "$sfall_dir" ]; then
    git clone "$sfall_repo" "$sfall_dir"
fi
cd "$sfall_dir"
git checkout master
git pull
git fetch --tags
last_v="v$(git tag | grep "^v" | sed 's|^v||' | sort -V | tail -1)"
git checkout "$last_v"
popd

pnpm exec tsx scripts/fallout-update/src/fallout-update.ts -s "$external" --sfall-file "$sfall_file" --highlight-file "$highlight_file"
./scripts/syntaxes-to-json.sh
