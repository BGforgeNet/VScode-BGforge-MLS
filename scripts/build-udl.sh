#!/bin/bash

# Generate Notepad++ UDL (User Defined Language) XML files from YAML data.
# Produces one UDL per language in a versioned zip archive.

set -eu -o pipefail

version=$(node -p "require('./package.json').version")
bundle_name="bgforge-mls-notepadpp-udl"
out_dir="${bundle_name}"
out_zip="${bundle_name}-${version}.zip"

rm -rf "$out_dir" "$out_zip"

pnpm exec tsx scripts/utils/src/generate-udl.ts --out-dir "$out_dir"

zip -rq "$out_zip" "$out_dir"
rm -rf "$out_dir"

echo "Created $out_zip"
