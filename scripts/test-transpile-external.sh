#!/bin/bash

# E2E transpiler test: transpile .td/.tbaf/.tssl from external repos,
# write output, verify git status is clean (no changes to committed .d/.baf/.ssl).
# Runs each file in a separate node process to isolate esbuild-wasm state.

set -eu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CLI="$ROOT_DIR/cli/transpile/out/transpile-cli.js"

# shellcheck source=scripts/timing-lib.sh
source "$SCRIPT_DIR/timing-lib.sh"

# Build CLI if missing
if [[ ! -f "$CLI" ]]; then
    step "Building transpile CLI"
    (cd "$ROOT_DIR" && pnpm build:transpile-cli)
fi

FAILED=0
PASS=0
SKIP=0

# Transpile all files in a repo, then check git status for changes.
# $1: base directory (e.g., external/infinity-engine)
# $2+: repo names
test_repos() {
    local base_dir="$1"
    shift

    for repo in "$@"; do
        local dir="$base_dir/$repo"
        if [[ ! -d "$dir" ]]; then
            echo "SKIP: $repo (not cloned)"
            SKIP=$((SKIP + 1))
            continue
        fi

        # Reset to committed state before testing
        git -C "$dir" checkout .

        # Install dependencies if node_modules is missing.
        # --ignore-workspace prevents pnpm from resolving to the parent monorepo workspace.
        if [[ -f "$dir/package.json" && ! -d "$dir/node_modules" ]]; then
            echo "Installing dependencies for $repo..."
            (cd "$dir" && pnpm install --ignore-workspace)
        fi

        step "Transpiling: $repo"

        # Transpile each file individually, writing output with --save
        local errors=0
        while IFS= read -r -d '' file; do
            if ! node --no-warnings "$CLI" "$file" --save 2>&1; then
                echo "ERROR: $file"
                errors=$((errors + 1))
            fi
        done < <(find "$dir" -type f \( -name '*.td' -o -name '*.tbaf' -o -name '*.tssl' \) -print0 | sort -z)

        if [[ $errors -ne 0 ]]; then
            echo "FAIL: $repo ($errors transpilation errors)"
            FAILED=$((FAILED + 1))
            continue
        fi

        # Check git status — any modified files mean transpiler output changed
        local changed
        changed=$(git -C "$dir" diff --name-only)
        if [[ -n "$changed" ]]; then
            echo "FAIL: $repo (output differs from committed files)"
            git -C "$dir" diff --stat
            FAILED=$((FAILED + 1))
        else
            PASS=$((PASS + 1))
        fi
    done
}

# Infinity Engine repos (TD, TBAF)
test_repos "$ROOT_DIR/external/infinity-engine" bg2-tweaks-and-tricks bg2-wildmage

# Fallout repos (TSSL)
test_repos "$ROOT_DIR/external/fallout" FO2tweaks

echo ""
echo "Transpiler E2E: $PASS passed, $FAILED failed, $SKIP skipped"

if [[ $FAILED -ne 0 ]]; then
    exit 1
fi

timing_summary "Transpile external tests passed"
