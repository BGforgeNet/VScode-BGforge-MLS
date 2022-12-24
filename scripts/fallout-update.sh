#!/bin/bash

set -xeu -o pipefail

# launch from root repo dir

external="external/fallout"
sfall_repo="https://github.com/BGforgeNet/sfall.git"
sfall_branch="better-docs"
sfall_dir="sfall"
rpu_repo="https://github.com/BGforgeNet/Fallout2_Restoration_Project"
rpu_dir="rpu"
sfall_file="server/data/fallout-ssl-sfall.yml"
highlight_file="syntaxes/fallout-ssl.tmLanguage.yml"

if [ ! -d $external ]; then
    mkdir $external
fi

# rpu
pushd .
cd $external
if [ ! -d $rpu_dir ]; then
    git clone $rpu_repo $rpu_dir
fi
cd $rpu_dir
git checkout master
git pull
last_v="v$(git tag | grep "^v" | sed 's|^v||' | sort -n | tail -1)"
git checkout $last_v
popd

# sfall
pushd .
cd $external
if [ ! -d $sfall_dir ]; then
    git clone $sfall_repo $sfall_dir
fi
cd $sfall_dir
git checkout master
git pull
last_v="v$(git tag | grep "^v" | sed 's|^v||' | sort -n | tail -1)"
git checkout $last_v
popd

./scripts/fallout-update.py -s "$external" --sfall-file "$sfall_file" --highlight-file "$highlight_file"

./scripts/syntaxes_to_json.sh
