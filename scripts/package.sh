#!/bin/bash

# Package the extension into a VSIX.
# Replaces pnpm symlinks with real directories so vsce includes them,
# then restores symlinks after packaging (via trap).

set -e

# Runtime deps that are pnpm symlinks and need real copies for vsce.
symlinks=(
    "server/node_modules/sslc-emscripten-noderawfs"
    "server/node_modules/esbuild-wasm"
)

# Parallel arrays to store original symlink targets for restore.
declare -a symlink_targets

restore() {
    for i in "${!symlinks[@]}"; do
        local link="${symlinks[$i]}"
        local target="${symlink_targets[i]}"
        if [ -n "$target" ]; then
            rm -rf "$link"
            ln -s "$target" "$link"
            echo "Restored symlink: $link"
        fi
    done
}

trap restore EXIT

for i in "${!symlinks[@]}"; do
    link="${symlinks[$i]}"
    if [ -L "$link" ]; then
        symlink_targets[i]=$(readlink "$link")
        absolute_target=$(readlink -f "$link")
        rm "$link"
        cp -rL "$absolute_target" "$link"
        echo "Replaced symlink with copy: $link"
    else
        symlink_targets[i]=""
    fi
done

# Validate that .vscodeignore patterns match real files before packaging.
pnpm exec tsx scripts/test-package-deps.ts

# No --no-dependencies: vsce's npm install creates root node_modules/ needed for
# typescriptServerPlugins (bgforge-tssl-plugin, bgforge-td-plugin).
pnpm vsce package "$@"
