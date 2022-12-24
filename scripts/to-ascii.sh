#!/bin/bash

# clean up some non-ascii chars

set -xeu -o pipefail

data_dir="server/data"

for yaml_file in "$data_dir"/*.yml; do
    sed -i "s|’|'|g" "$yaml_file"
    sed -i "s|–|-|g" "$yaml_file"
done

wait
