#!/bin/bash

# Generate Geany filetype definition (.conf) files from YAML data.
# Produces bgforge-mls-geany-<version>.zip for Geany editor.

set -eu -o pipefail

version=$(node -p "require('./package.json').version")
bundle_name="bgforge-mls-geany"
out_dir="${bundle_name}"
out_zip="${bundle_name}-${version}.zip"

rm -rf "$out_dir" "$out_zip"
pnpm exec tsx scripts/utils/src/generate-geany.ts --out-dir "$out_dir"

# Copy hand-written conf files for languages that don't fit the generator model.
# Static files: scripts/static/geany/<name>.conf -> filetypes.<name>.conf
for f in scripts/static/geany/*.conf; do
    [ -e "$f" ] || continue
    base=$(basename "$f" .conf)
    cp "$f" "$out_dir/filetypes.${base}.conf"
done

zip -rq "$out_zip" "$out_dir"
rm -rf "$out_dir"

echo "Created $out_zip"
