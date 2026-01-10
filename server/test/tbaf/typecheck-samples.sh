#!/bin/bash

# Validate TBAF samples are valid TypeScript syntax

set -e

cd "$(dirname "$0")"
ROOT="$(cd ../../../ && pwd)"
TSC="$ROOT/node_modules/.bin/tsc"

fail=0
pass=0

for sample in samples/*.tbaf; do
    name=$(basename "$sample" .tbaf)
    link="${name}.ts"

    ln -sf "$sample" "$link"

    if $TSC --noEmit --allowUnusedLabels --lib ES2015 tbaf-runtime.d.ts "$link" 2>&1; then
        echo "PASS: $name"
        pass=$((pass + 1))
    else
        echo "FAIL: $name"
        fail=$((fail + 1))
    fi

    rm -f "$link"
done

echo ""
echo "TBAF typecheck: $pass passed, $fail failed"

if [[ $fail -gt 0 ]]; then
    exit 1
fi
