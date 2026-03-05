#!/bin/bash

# Build a TextMate bundle (.tmbundle) from the JSON grammar files in syntaxes/.
# Produces bgforge-mls-<version>.tmbundle.zip for use in Sublime Text and JetBrains IDEs.
#
# Excludes VSCode-specific injection grammars (comment/string/docstring) and
# tooltip grammars that only work inside the VSCode extension.

set -eu -o pipefail

version=$(node -p "require('./package.json').version")
bundle_name="bgforge-mls"
bundle_dir="${bundle_name}.tmbundle"
out_zip="${bundle_name}-${version}.tmbundle.zip"

rm -rf "$bundle_dir" "$out_zip"
mkdir -p "$bundle_dir/Syntaxes"

# info.plist: minimal bundle metadata required by TextMate / JetBrains
cat > "$bundle_dir/info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>name</key>
	<string>BGforge MLS</string>
	<key>contactName</key>
	<string>BGforge</string>
	<key>description</key>
	<string>Syntax grammars for Fallout SSL, WeiDU (BAF, D, TP2, TRA), and related formats.</string>
	<key>uuid</key>
	<string>b8f3e4a1-7c2d-4f5e-9a1b-3d6e8f0c2a4b</string>
</dict>
</plist>
PLIST

# Copy language grammars, excluding VSCode-specific injection and tooltip grammars.
for f in syntaxes/*.tmLanguage.json; do
    base=$(basename "$f")
    case "$base" in
        bgforge-mls-*|*-tooltip.*) continue ;;
    esac
    cp "$f" "$bundle_dir/Syntaxes/"
done

# Create zip archive
zip -rq "$out_zip" "$bundle_dir"
rm -rf "$bundle_dir"

echo "Created $out_zip"
