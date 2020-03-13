#!/bin/bash

set -xeu -o pipefail

# launch from root repo dir

ielib_repo="https://github.com/BGforgeNet/BGforge-MLS-IElib.git"
ielib_dir="ielib"
completion_dir="server/out"
completion_file="$completion_dir/weidu.completion.yml"
highlight_file="syntaxes/weidu.tmLanguage.yml"
external="external/ie"
iesdp_repo="https://github.com/Gibberlings3/iesdp.git"
iesdp_dir="iesdp"

if [ ! -d $external ]; then
  mkdir $external
fi

# IElib
pushd .
cd $external
if [ ! -d $ielib_dir ]; then
  git clone $ielib_repo $ielib_dir
fi
cd $ielib_dir
git pull
popd
./scripts/ielib-update.py -s $external/$ielib_dir --completion-file "$completion_file" --highlight-file "$highlight_file"

# IESDP
pushd .
cd $external
if [ ! -d $iesdp_dir ]; then
  git clone $iesdp_repo $iesdp_dir  
fi
cd $iesdp_dir
git pull
popd
./scripts/iesdp-update.py -s $external/$iesdp_dir --completion-baf server/out/weidu-baf.completion.yml --highlight-baf syntaxes/weidu.baf.tmLanguage.yml

# ssl should have the same completion as baf
cp -f "$completion_dir/weidu-baf.completion.yml" "$completion_dir/weidu-ssl.completion.yml"

# convert yaml to json
./scripts/syntaxes_to_json.sh
