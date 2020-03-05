#!/bin/bash

set -xeu -o pipefail

# launch from root repo dir
tmp_dir='tmp'
repo="BGforgeNet/BGforge-MLS-IElib"
completion_file="server/out/weidu.completion.yml"
highlight_file="syntaxes/weidu.tmLanguage.yml"
external="external"
iesdp_repo="https://github.com/Gibberlings3/iesdp.git"
iesdp_dir="iesdp"

# IElib
rm -rf "$tmp_dir"; mkdir "$tmp_dir"; cd "$tmp_dir"
ghclone "https://github.com/$repo/tree/master"
cd ..
./scripts/ielib-update.py -s "$tmp_dir" --completion-file "$completion_file" --highlight-file "$highlight_file"

rm -rf "$tmp_dir"

# IESDP
pushd .
if [ ! -d $external ]; then
  mkdir $external
fi
cd $external
if [ ! -d $iesdp_dir ]; then
  git clone $iesdp_repo $iesdp_dir  
fi
cd $iesdp_dir
git pull
popd
./scripts/iesdp-update.py -s $external/$iesdp_dir --completion-baf server/out/weidu-baf.completion.yml --highlight-baf syntaxes/weidu.baf.tmLanguage.yml

./scripts/syntaxes_to_json.sh
