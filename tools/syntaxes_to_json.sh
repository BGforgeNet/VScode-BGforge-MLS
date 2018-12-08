#!/bin/bash

set -xeu -o pipefail

tools_dir="tools"
yaml2json="$tools_dir/yaml2json.py"
syntaxes_dir="syntaxes"

function convert() {
  yaml_file="$1"
  json_file="$(echo $yaml_file | sed 's|\.yml|.json|i')"
  $yaml2json "$syntaxes_dir/$yaml_file" "$syntaxes_dir/$json_file"
}

for yaml_file in $(ls $syntaxes_dir | grep -i "\.yml"); do
  convert "$yaml_file" &
done

wait
