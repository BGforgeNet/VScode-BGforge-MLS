#!/bin/bash

# Validate TD samples are valid TypeScript syntax.

set -e

cd "$(dirname "$0")"
ROOT="$(cd ../../../ && pwd)"
TSC="$ROOT/node_modules/.bin/tsc"

# Create all symlinks first
links=()
for sample in samples/*.td; do
    name=$(basename "$sample" .td)
    link="${name}.ts"
    ln -sf "$sample" "$link"
    links+=("$link")
done

# Typecheck all samples
if $TSC --noEmit --target ES2015 --skipLibCheck --allowUnusedLabels --lib ES2015 td-runtime.d.ts td-engine-stubs.d.ts "${links[@]}" 2>&1; then
    echo "TD typecheck: ${#links[@]} passed, 0 failed"
else
    exit 1
fi

rm -f "${links[@]}"
