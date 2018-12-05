#!/bin/bash

set -xeu -o pipefail

tools_dir="tools"
yaml2json="$tools_dir/yaml2json.py"
syntaxes_dir="syntaxes"

for yaml_file in $(ls $syntaxes_dir | grep -i "\.yaml"); do
  json_file="$(echo $yaml_file | sed 's|\.yaml|.json|i')"
  $yaml2json "$syntaxes_dir/$yaml_file" "$syntaxes_dir/$json_file"
done
