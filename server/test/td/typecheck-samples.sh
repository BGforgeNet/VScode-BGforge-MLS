#!/bin/bash

# Validate TD samples are valid TypeScript syntax (single tsc invocation)

set -e

cd "$(dirname "$0")"
ROOT="$(cd ../../../ && pwd)"
TSC="$ROOT/node_modules/.bin/tsc"

# Create symlinks for all samples
links=()
for sample in samples/*.td; do
    name=$(basename "$sample" .td)
    link="${name}.ts"
    ln -sf "$sample" "$link"
    links+=("$link")
done

# Single tsc invocation for all files
if $TSC --noEmit --target ES2015 --skipLibCheck --allowUnusedLabels --lib ES2015 td-runtime.d.ts "${links[@]}" 2>&1; then
    echo "TD typecheck: ${#links[@]} passed, 0 failed"
else
    echo "TD typecheck: FAILED"
    rm -f "${links[@]}"
    exit 1
fi

rm -f "${links[@]}"
