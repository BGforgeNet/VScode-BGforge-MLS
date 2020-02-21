#!/bin/bash

set -xeu -o pipefail

# launch from root repo dir
tmp_dir='tmp'
repo="BGforgeNet/BGforge-MLS-IElib"
completion_file="server/out/weidu.completion.yml"
highlight_file="syntaxes/weidu.tmLanguage.yml"

rm -rf "$tmp_dir"; mkdir "$tmp_dir"; cd "$tmp_dir"
ghclone "https://github.com/$repo/tree/master"
cd ..

./scripts/ie-update.py -s "$tmp_dir" --completion-file "$completion_file" --highlight-file "$highlight_file"

rm -rf "$tmp_dir"

./scripts/syntaxes_to_json.sh
