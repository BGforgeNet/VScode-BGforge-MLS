#!/bin/bash

set -xeu -o pipefail

# launch from root repo dir

ielib_repo="https://github.com/BGforgeNet/BGforge-MLS-IElib.git"
ielib_dir="ielib"
completion_dir="server/out"
completion_weidu="$completion_dir/weidu.completion.yml"
completion_baf="$completion_dir/weidu-baf.completion.yml"
highlight_weidu="syntaxes/weidu.tmLanguage.yml"
highlight_baf="syntaxes/weidu.baf.tmLanguage.yml"

external="external/ie"
iesdp_repo="https://github.com/Gibberlings3/iesdp.git"
iesdp_dir="iesdp"

if [ ! -d "$external" ]; then
  mkdir "$external"
fi

# IElib
pushd .
cd $external
if [ ! -d "$ielib_dir" ]; then
  git clone "$ielib_repo" "$ielib_dir"
fi
cd "$ielib_dir"
git pull
popd
./scripts/ielib-update.py -s "$external/$ielib_dir" --completion-weidu "$completion_weidu" --highlight-weidu "$highlight_weidu"

# IESDP
pushd .
cd $external
if [ ! -d $iesdp_dir ]; then
  git clone $iesdp_repo $iesdp_dir  
fi
cd $iesdp_dir
git pull
popd
./scripts/iesdp-update.py -s "$external/$iesdp_dir" --completion-baf "$completion_baf" --highlight-baf "$highlight_baf" --completion-weidu "$completion_weidu" --highlight-weidu "$highlight_weidu"

# ssl should have the same completion as baf
cp -f "$completion_dir/weidu-baf.completion.yml" "$completion_dir/weidu-ssl.completion.yml"

# convert yaml to json
./scripts/syntaxes_to_json.sh
