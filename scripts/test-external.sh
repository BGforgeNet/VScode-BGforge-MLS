#!/bin/bash

# Test external repos: clone, parse, format, check idempotency.
# Tests both Fallout (SSL, PRO) and Infinity Engine (BAF, D, TP2) repos.

set -eu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

# Clone repos from a txt file into a directory
clone_repos() {
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
    done < "$txt_file"
}

# Remove excluded files from a directory
remove_excluded() {
    local exclude_file="$1"
    local target_dir="$2"

    [[ ! -f "$exclude_file" ]] && return
    for file in $(grep -v '^#' "$exclude_file" | grep -v '^$'); do
        # Skip dangerous paths: absolute, parent refs, or empty
        [[ "$file" =~ ^/ || "$file" =~ \.\. || -z "$file" ]] && continue
        rm -rf "$target_dir/$file"
    done
}

# Reset all repos in a directory
reset_repos() {
    local target_dir="$1"
    for repo in "$target_dir"/*/; do
        [[ -d "$repo" ]] && git -C "$repo" checkout . 2>/dev/null || true
    done
}

# Test formatter on a directory
test_format() {
    local target_dir="$1"
    local name="$2"

    if ! find "$target_dir" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | grep -q .; then
        echo "No $name repos to test"
        return
    fi

    echo ""
    echo "=== Formatting $name files ==="
    pnpm format "$target_dir" -r --save -q

    echo ""
    echo "=== Checking $name idempotency ==="
    pnpm format "$target_dir" -r --check -q
}

# Test bin CLI on Fallout PRO files
test_bin() {
    local target_dir="$1"

    if ! find "$target_dir" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | grep -q .; then
        return
    fi

    echo ""
    echo "=== Testing Fallout PRO files ==="
    local count=0
    while IFS= read -r -d '' f; do
        pnpm bin "$f" --check || { echo "FAIL: $f"; exit 1; }
        ((count++))
    done < <(find "$target_dir" -name "*.pro" -type f -print0)
    echo "Checked $count PRO files"
}

echo "=== Building CLIs ==="
pnpm build:format-cli
pnpm build:bin-cli

echo ""
echo "=== Setting up Fallout repos ==="
clone_repos "$ROOT_DIR/external/fallout.txt" "$ROOT_DIR/external/fallout"

echo ""
echo "=== Setting up Infinity Engine repos ==="
clone_repos "$ROOT_DIR/external/infinity-engine.txt" "$ROOT_DIR/external/infinity-engine"

echo ""
echo "=== Resetting repos (pre-test) ==="
reset_repos "$ROOT_DIR/external/fallout"
reset_repos "$ROOT_DIR/external/infinity-engine"

echo ""
echo "=== Removing excluded files ==="
remove_excluded "$ROOT_DIR/external/fallout-exclude.txt" "$ROOT_DIR/external/fallout"
remove_excluded "$ROOT_DIR/external/infinity-engine-exclude.txt" "$ROOT_DIR/external/infinity-engine"

test_format "$ROOT_DIR/external/fallout" "Fallout"
test_bin "$ROOT_DIR/external/fallout"
test_format "$ROOT_DIR/external/infinity-engine" "Infinity Engine"

echo ""
echo "=== Resetting repos (post-test) ==="
reset_repos "$ROOT_DIR/external/fallout"
reset_repos "$ROOT_DIR/external/infinity-engine"

echo ""
echo "SUCCESS: External tests passed"
