#!/bin/bash

set -xeu -o pipefail

tools_dir="scripts"
completion_dir="server/out"

for yaml_file in $(ls $completion_dir | grep -i "\.yml"); do
    sed -i "s|’|'|g" "$completion_dir/$yaml_file"
    sed -i "s|–|-|g" "$completion_dir/$yaml_file"
done

wait
