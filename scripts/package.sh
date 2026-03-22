#!/bin/bash

# Package the extension into a VSIX.
# Uses --no-dependencies to skip vsce's npm list (fails with pnpm's layout).
#
# Flow:
# 1. Run prepublish build (needs full pnpm deps)
# 2. Strip pnpm artifacts from server/node_modules (symlinks crash vsce's zip writer)
# 3. Package with SKIP_PREPUBLISH=1 to avoid rebuilding after strip
# 4. Inject TS plugins into VSIX (vsce's .vscodeignore re-include patterns don't
#    work for node_modules/ with --no-dependencies, so we add them post-packaging)
# 5. Restore server/node_modules via pnpm install

set -e

trap 'echo "Restoring node_modules..." && pnpm install --frozen-lockfile' EXIT

# Step 1: Build with full deps available.
./scripts/prepublish.sh

# Step 2: Deref pnpm symlinks for server runtime deps.
for dep in server/node_modules/sslc-emscripten-noderawfs server/node_modules/esbuild-wasm; do
    if [ -L "$dep" ]; then
        target=$(readlink -f "$dep")
        rm "$dep"
        cp -rL "$target" "$dep"
        echo "Dereffed: $dep"
    fi
done

# Strip all remaining pnpm symlinks from server/node_modules.
for entry in server/node_modules/*; do
    [ -L "$entry" ] && rm "$entry"
done

# Strip pnpm internal real dirs from server/node_modules.
# All @scoped dirs here are dev-only (pnpm symlinks to @types, @supercharge, etc).
# If a runtime @scoped dep is ever added, it must be dereffed in Step 2 above.
rm -rf server/node_modules/.bin server/node_modules/.vite
for dir in server/node_modules/@*/; do
    [ -d "$dir" ] && rm -rf "$dir"
done

# Step 3: Package without re-running prepublish.
mkdir -p dist
name=$(node -p "require('./package.json').name")
version=$(node -p "require('./package.json').version")
SKIP_PREPUBLISH=1 pnpm vsce package --no-dependencies --out "dist/${name}-${version}.vsix" "$@"

# Step 4: Inject TS plugins into VSIX.
# vsce excludes node_modules/ entirely with --no-dependencies; re-include
# patterns (!node_modules/pkg/) don't work. Inject the built plugin bundles
# into the VSIX post-packaging. tsserver requires plugins in node_modules/.
vsix_file="dist/${name}-${version}.vsix"

if [ ! -f "$vsix_file" ]; then
    echo "ERROR: expected $vsix_file not found after vsce package"
    exit 1
fi

echo "Injecting TS plugins into $vsix_file"

plugin_files=(
    "node_modules/bgforge-tssl-plugin/package.json"
    "node_modules/bgforge-tssl-plugin/index.js"
    "node_modules/bgforge-td-plugin/package.json"
    "node_modules/bgforge-td-plugin/index.js"
)

for f in "${plugin_files[@]}"; do
    if [ ! -f "$f" ]; then
        echo "ERROR: $f not found, cannot inject into VSIX"
        exit 1
    fi
done

inject_dir=".pkg-inject"
rm -rf "$inject_dir"
mkdir -p "$inject_dir/extension/node_modules/bgforge-tssl-plugin"
mkdir -p "$inject_dir/extension/node_modules/bgforge-td-plugin"
cp node_modules/bgforge-tssl-plugin/package.json node_modules/bgforge-tssl-plugin/index.js \
    "$inject_dir/extension/node_modules/bgforge-tssl-plugin/"
cp node_modules/bgforge-td-plugin/package.json node_modules/bgforge-td-plugin/index.js \
    "$inject_dir/extension/node_modules/bgforge-td-plugin/"

(cd "$inject_dir" && zip -g "../$vsix_file" \
    extension/node_modules/bgforge-tssl-plugin/package.json \
    extension/node_modules/bgforge-tssl-plugin/index.js \
    extension/node_modules/bgforge-td-plugin/package.json \
    extension/node_modules/bgforge-td-plugin/index.js)

rm -rf "$inject_dir"

echo "Done"
