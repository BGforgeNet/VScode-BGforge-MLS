#!/bin/bash

# Regenerate expected .d output files from .td samples.

set -e

cd "$(dirname "$0")"
ROOT="$(cd ../../../ && pwd)"

CLI="$ROOT/server/out/td-cli.js"

for sample in samples/*.td; do
    name=$(basename "$sample" .td)
    echo "Regenerating ${name}.d..."
    node --no-warnings "$CLI" "$sample" > "samples-expected/${name}.d"
done

echo "Done."
