#!/bin/bash

set -xeu -o pipefail

# launch from root repo dir

highlight_baf="syntaxes/weidu-baf.tmLanguage.yml"
highlight_weidu="syntaxes/weidu-tp2.tmLanguage.yml"

data_dir="server/data"
data_baf="$data_dir/weidu-baf-iesdp.yml"

external="external/infinity-engine"
mkdir -p "$external"
iesdp_repo="https://github.com/BGforgeNet/iesdp.git"
ielib_repo="https://github.com/BGforgeNet/BGforge-MLS-IElib.git"
iesdp_dir="$external/iesdp"
ielib_dir="$external/ielib"

# IESDP (actions only)
pushd .
if [ ! -d "$iesdp_dir" ]; then
    git clone "$iesdp_repo" "$iesdp_dir"
fi
cd "$iesdp_dir"
git checkout ielib
git pull
popd

# IElib (structure offsets for IESDP highlight patterns)
pushd .
if [ ! -d "$ielib_dir" ]; then
    git clone "$ielib_repo" "$ielib_dir"
fi
cd "$ielib_dir"
git pull
popd

pnpm exec tsx scripts/ie-update/src/iesdp-update.ts -s "$iesdp_dir" \
    --highlight-baf "$highlight_baf" \
    --data-baf "$data_baf"

pnpm exec tsx scripts/ie-update/src/ielib-update.ts -s "$ielib_dir" \
    --highlight-weidu "$highlight_weidu"

# convert yaml to json
./scripts/syntaxes-to-json.sh
