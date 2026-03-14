#!/bin/bash

# Reset all external repos to their committed state (git checkout .).
# If repos don't exist, clone them first.
# Used before tests that read external files, and for manual cleanup.

set -eu -o pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Clone repos if they don't exist
clone_if_missing() {
    local txt_file="$1"
    local target_dir="$2"

    mkdir -p "$target_dir"
    while IFS= read -r url || [[ -n "$url" ]]; do
        [[ -z "$url" || "$url" == \#* ]] && continue
        name=$(basename "$url" .git)
        if [[ -d "$target_dir/$name" ]]; then
            echo "  Already cloned: $name"
        else
            echo "  Cloning: $name"
            git clone --depth 1 "$url" "$target_dir/$name"
        fi
    done <"$txt_file"
}

# Clone missing repos first
if [[ -f "$ROOT_DIR/external/fallout.txt" ]]; then
    echo "Cloning missing external repos..."
    clone_if_missing "$ROOT_DIR/external/fallout.txt" "$ROOT_DIR/external/fallout"
    clone_if_missing "$ROOT_DIR/external/infinity-engine.txt" "$ROOT_DIR/external/infinity-engine"
fi

# Reset existing repos to clean state
for dir in "$ROOT_DIR"/external/fallout/*/ "$ROOT_DIR"/external/infinity-engine/*/; do
    if [[ -d "$dir/.git" ]]; then
        git -C "$dir" checkout . 2>/dev/null || true
    fi
done

echo "External repos reset"
