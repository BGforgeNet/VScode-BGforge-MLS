#!/bin/bash

# Regenerate hover and completion JSONs from server/data YAMLs

set -xeu -o pipefail

data_dir="server/data"
dest_dir="server/out"

./scripts/generate-data.py \
    -i $data_dir/fallout-ssl-base.yml $data_dir/fallout-ssl-sfall.yml \
    --completion $dest_dir/completion.fallout-ssl.json \
    --hover $dest_dir/hover.fallout-ssl.json \
    --signature $dest_dir/signature.fallout-ssl.json \
    --tooltip-lang fallout-ssl-tooltip

./scripts/generate-data.py \
    -i $data_dir/weidu-tp2-base.yml $data_dir/weidu-tp2-iesdp.yml $data_dir/weidu-tp2-ielib.yml \
    --completion $dest_dir/completion.weidu-tp2.json \
    --hover $dest_dir/hover.weidu-tp2.json \
    --tooltip-lang weidu-tp2-tooltip

./scripts/generate-data.py \
    -i $data_dir/weidu-baf-base.yml $data_dir/weidu-baf-iesdp.yml \
    --completion $dest_dir/completion.weidu-baf.json \
    --hover $dest_dir/hover.weidu-baf.json \
    --tooltip-lang weidu-baf

./scripts/generate-data.py \
    -i $data_dir/weidu-d-base.yml \
    --completion $dest_dir/completion.weidu-d.json \
    --hover $dest_dir/hover.weidu-d.json \
    --tooltip-lang weidu-d-tooltip
