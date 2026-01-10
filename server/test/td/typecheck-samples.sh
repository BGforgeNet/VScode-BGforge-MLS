#!/bin/bash

# Validate TD samples are valid TypeScript syntax

set -e

cd "$(dirname "$0")"
ROOT="$(cd ../../../ && pwd)"
TSC="$ROOT/node_modules/.bin/tsc"

fail=0
pass=0

for sample in samples/*.td; do
    name=$(basename "$sample" .td)
    link="${name}.ts"

    ln -sf "$sample" "$link"

    if $TSC --noEmit --target ES2015 --skipLibCheck --allowUnusedLabels --lib ES2015 td-runtime.d.ts "$link" 2>&1; then
        echo "PASS: $name"
        pass=$((pass + 1))
    else
        echo "FAIL: $name"
        fail=$((fail + 1))
    fi

    rm -f "$link"
done

echo ""
echo "TD typecheck: $pass passed, $fail failed"

if [[ $fail -gt 0 ]]; then
    exit 1
fi
