#!/bin/bash

set -xeu -o pipefail

# launch from root repo dir

repo="BGforgeNet/sfall"
branch="better-docs"
base_url="https://raw.githubusercontent.com/$repo/$branch/artifacts/scripting"
func_file="functions.yml"
func_url="$base_url/$func_file"
hooks_file="hooks.yml"
hooks_url="$base_url/$hooks_file"
completion_file="./server/out/fallout-ssl.completion.yml"
highlight_file="./syntaxes/fallout-ssl.tmLanguage.yml"

rm -f "$hooks_file" "$func_file"
wget "$func_url"
wget "$hooks_url"
./scripts/fallout-update.py "$func_file" "$hooks_file" "$completion_file" "$highlight_file"
rm -f "$hooks_file" "$func_file"
./scripts/syntaxes_to_json.sh
