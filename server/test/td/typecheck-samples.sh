#!/bin/bash

# Validate TD samples are valid TypeScript syntax.
# Each sample is compiled individually since samples may define functions with
# the same names (e.g. familiars.td and familiars_v2.td).

set -e

cd "$(dirname "$0")"
ROOT="$(cd ../../../ && pwd)"
TSC="$ROOT/node_modules/.bin/tsc"

passed=0
failed=0
failed_files=()

for sample in samples/*.td; do
    name=$(basename "$sample" .td)
    link="${name}.ts"
    ln -sf "$sample" "$link"

    if $TSC --noEmit --target ES2015 --skipLibCheck --allowUnusedLabels --lib ES2015 td-runtime.d.ts td-engine-stubs.d.ts "$link" 2>&1; then
        passed=$((passed + 1))
    else
        failed=$((failed + 1))
        failed_files+=("$name")
    fi

    rm -f "$link"
done

if [ $failed -gt 0 ]; then
    echo "TD typecheck: $passed passed, $failed failed: ${failed_files[*]}"
    exit 1
fi

echo "TD typecheck: $passed passed, 0 failed"
