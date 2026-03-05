#!/bin/bash

# Build KDE KSyntaxHighlighting definitions from YAML data.
# Produces bgforge-mls-kate-ksh-<version>.zip for Kate/KWrite/KDE editors.

set -eu -o pipefail

version=$(node -p "require('./package.json').version")
bundle_name="bgforge-mls-kate-ksh"
out_dir="${bundle_name}"
out_zip="${bundle_name}-${version}.zip"

rm -rf "$out_dir" "$out_zip"
pnpm exec tsx scripts/utils/src/generate-ksh.ts --out-dir "$out_dir"
zip -rq "$out_zip" "$out_dir"
rm -rf "$out_dir"

echo "Created $out_zip"
