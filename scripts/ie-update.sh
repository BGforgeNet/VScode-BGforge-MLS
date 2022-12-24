#!/bin/bash

set -xeu -o pipefail

# launch from root repo dir

ielib_repo="https://github.com/BGforgeNet/BGforge-MLS-IElib.git"
ielib_dir="ielib"
data_dir="server/data"

highlight_baf="syntaxes/weidu-baf.tmLanguage.yml"
highlight_weidu="syntaxes/weidu-tp2.tmLanguage.yml"
data_dir="server/data"
data_weidu_iesdp="$data_dir/weidu-tp2-iesdp.yml"
data_weidu_ielib="$data_dir/weidu-tp2-ielib.yml"
data_baf="$data_dir/weidu-baf-iesdp.yml"

external="external/ie"
mkdir -p "$external"
iesdp_repo="https://github.com/Gibberlings3/iesdp.git"
iesdp_dir="$external/iesdp"
ielib_dir="$external/ielib"

# IESDP - also updates IElib
pushd .
if [ ! -d "$iesdp_dir" ]; then
    git clone "$iesdp_repo" "$iesdp_dir"
fi
cd $iesdp_dir
git checkout ielib
git pull
popd
./scripts/iesdp-update.py -s "$iesdp_dir" \
    --highlight-baf "$highlight_baf" \
    --data-baf "$data_baf" \
    --highlight-weidu "$highlight_weidu" \
    --iesdp-file "$data_weidu_iesdp" \
    --ielib-dir "$ielib_dir"

# IElib
pushd .
if [ ! -d "$ielib_dir" ]; then
    git clone "$ielib_repo" "$ielib_dir"
fi
cd "$ielib_dir"
git pull
popd
./scripts/ielib-update.py -s "$ielib_dir" --data-file "$data_weidu_ielib" --highlight-weidu "$highlight_weidu"

# convert yaml to json
./scripts/syntaxes_to_json.sh
