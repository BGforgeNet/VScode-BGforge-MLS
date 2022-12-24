#!/bin/bash

set -xeu -o pipefail

tools_dir="scripts"
yaml2json="$tools_dir/yaml2json.py"
syntaxes_dir="syntaxes"
error_file="$(basename "$0").err"

function convert() {
    yaml_file="$1"
    json_file="$(echo "$yaml_file" | sed 's|\.yml$|.json|i')"
    $yaml2json "$yaml_file" "$json_file"
}

rm -f "$error_file"
for yaml_file in "$syntaxes_dir"/*.yml; do
    convert "$yaml_file" || touch "$error_file" &
done

wait

if [[ -f "$error_file" ]]; then
    echo "Failed!"
    exit 1
fi
