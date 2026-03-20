#!/bin/bash

set -xeu -o pipefail

# launch from root repo dir

highlight_baf="syntaxes/weidu-baf.tmLanguage.yml"

data_dir="server/data"
data_baf="$data_dir/weidu-baf-iesdp.yml"

external="external/infinity-engine"
mkdir -p "$external"
iesdp_repo="https://github.com/BGforgeNet/iesdp.git"
iesdp_dir="$external/iesdp"

# IESDP (BAF actions/triggers)
pushd .
if [ ! -d "$iesdp_dir" ]; then
    git clone "$iesdp_repo" "$iesdp_dir"
fi
cd "$iesdp_dir"
git checkout ielib
git pull
popd

pnpm exec tsx scripts/ie-update/src/iesdp-update.ts -s "$iesdp_dir" \
    --highlight-baf "$highlight_baf" \
    --data-baf "$data_baf"

# convert yaml to json
./scripts/syntaxes-to-json.sh
