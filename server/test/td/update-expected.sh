#!/bin/bash

# Regenerate expected .d output files from TD samples.
# Run after changing the emitter to update test baselines.

set -e

cd "$(dirname "$0")"
ROOT="$(cd ../../../ && pwd)"

CLI="$ROOT/cli/transpile/out/transpile-cli.js"

updated=0

for sample in samples/*.td; do
    name=$(basename "$sample" .td)
    expected="samples-expected/${name}.d"

    if [[ ! -f "$expected" ]]; then
        continue
    fi

    node --no-warnings "$CLI" "$sample" > "$expected"
    updated=$((updated + 1))
done

echo "Updated $updated expected files"
