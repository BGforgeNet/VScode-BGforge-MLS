#!/bin/bash

# Test external repos: clone, parse, format, check idempotency.
# Tests both Fallout (SSL, PRO) and Infinity Engine (BAF, D, TP2) repos.

set -eu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

# shellcheck source=scripts/timing-lib.sh
source "$SCRIPT_DIR/timing-lib.sh"

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
    while IFS= read -r file; do
        [[ -z "$file" || "$file" == \#* ]] && continue
        # Skip dangerous paths: absolute or parent refs
        [[ "$file" =~ ^/ || "$file" =~ \.\. ]] && continue
        rm -rf "${target_dir:?}/$file"
    done < "$exclude_file"
}

reset_repos() {
    "$SCRIPT_DIR/reset-external.sh"
}

# Always reset repos on exit (success or failure)
trap reset_repos EXIT

# Test formatter on a directory
test_format() {
    local target_dir="$1"
    local name="$2"

    if ! find "$target_dir" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | grep -q .; then
        echo "No $name repos to test"
        return
    fi

    step "Formatting $name files"
    pnpm format "$target_dir" -r --save -q

    step "Checking $name idempotency"
    pnpm format "$target_dir" -r --check -q
}

# Test bin CLI on Fallout PRO files (parse only, no snapshot comparison)
test_bin() {
    local target_dir="$1"

    if ! find "$target_dir" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | grep -q .; then
        return
    fi

    step "Testing Fallout PRO files"
    # Stdout mode outputs JSON - discard it, we only care about exit code (parse success)
    node "$ROOT_DIR/cli/bin/out/bin-cli.js" "$target_dir" -r -q > /dev/null
}

step "Building CLIs"
pnpm build:format-cli
pnpm build:bin-cli

step "Setting up Fallout repos"
clone_repos "$ROOT_DIR/external/fallout.txt" "$ROOT_DIR/external/fallout"

step "Setting up Infinity Engine repos"
clone_repos "$ROOT_DIR/external/infinity-engine.txt" "$ROOT_DIR/external/infinity-engine"

step "Resetting repos (pre-test)"
reset_repos

step "Removing excluded files"
remove_excluded "$ROOT_DIR/external/fallout-exclude.txt" "$ROOT_DIR/external/fallout"
remove_excluded "$ROOT_DIR/external/infinity-engine-exclude.txt" "$ROOT_DIR/external/infinity-engine"

test_format "$ROOT_DIR/external/fallout" "Fallout"
test_bin "$ROOT_DIR/external/fallout"
test_format "$ROOT_DIR/external/infinity-engine" "Infinity Engine"

timing_summary "External tests passed"
