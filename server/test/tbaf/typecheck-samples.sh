#!/bin/bash

# Validate TBAF samples are valid TypeScript syntax (single tsc invocation)

set -e

cd "$(dirname "$0")"
ROOT="$(cd ../../../ && pwd)"
TSC="$ROOT/node_modules/.bin/tsc"

# Create symlinks for all samples
links=()
for sample in samples/*.tbaf; do
    name=$(basename "$sample" .tbaf)
    link="${name}.ts"
    ln -sf "$sample" "$link"
    links+=("$link")
done

# Single tsc invocation for all files
if $TSC --noEmit --allowUnusedLabels --lib ES2015 tbaf-runtime.d.ts "${links[@]}" 2>&1; then
    echo "TBAF typecheck: ${#links[@]} passed, 0 failed"
else
    echo "TBAF typecheck: FAILED"
    rm -f "${links[@]}"
    exit 1
fi

rm -f "${links[@]}"
