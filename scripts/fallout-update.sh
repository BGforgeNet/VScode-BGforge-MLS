#!/bin/bash

set -xeu -o pipefail

# launch from root repo dir

tmp_dir='tmp'
sfall_repo="BGforgeNet/sfall"
sfall_branch="better-docs"
rpu_repo="BGforgeNet/Fallout2_Restoration_Project"
rpu_branch="master"
completion_file="server/out/fallout-ssl.completion.yml"
highlight_file="syntaxes/fallout-ssl.tmLanguage.yml"

rm -rf "$tmp_dir"; mkdir "$tmp_dir"; cd "$tmp_dir"
# sfall
ghclone "https://github.com/$sfall_repo/tree/$sfall_branch/artifacts/scripting"
# RPU
ghclone "https://github.com/$rpu_repo/tree/$rpu_branch/scripts_src/headers"
cd ..

./scripts/fallout-update.py -s "$tmp_dir" --completion-file "$completion_file" --highlight-file "$highlight_file"

rm -rf "$tmp_dir"

./scripts/syntaxes_to_json.sh
