#!/bin/bash

# Test external repos: clone, parse, format, check idempotency.

set -eu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EXTERNAL_DIR="$ROOT_DIR/external/grammars"

cd "$ROOT_DIR"

echo "=== Building format CLI ==="
pnpm build:format-cli

echo ""
echo "=== Setting up external repos ==="
mkdir -p "$EXTERNAL_DIR"
while IFS= read -r url || [[ -n "$url" ]]; do
    [[ -z "$url" || "$url" == \#* ]] && continue
    name=$(basename "$url" .git)
    if [[ -d "$EXTERNAL_DIR/$name" ]]; then
        echo "Already cloned: $name"
    else
        echo "Cloning: $name"
        git clone --depth 1 "$url" "$EXTERNAL_DIR/$name"
    fi
done < "$ROOT_DIR/external/grammars.txt"

# Check if any repos exist
if ! find "$EXTERNAL_DIR" -mindepth 1 -maxdepth 1 -type d | grep -q .; then
    echo "No external repos to test"
    echo "SUCCESS: All grammar tests passed"
    exit 0
fi

echo ""
echo "=== Resetting external repos (pre-test) ==="
for repo in "$EXTERNAL_DIR"/*/; do
    git -C "$repo" checkout . 2>/dev/null || true
done

echo ""
echo "=== Removing excluded files ==="
for file in $(grep -v '^#' "$ROOT_DIR/external/grammars-exclude.txt" | grep -v '^$'); do
    # Skip dangerous paths: absolute, parent refs, or empty
    [[ "$file" =~ ^/ || "$file" =~ \.\. || -z "$file" ]] && continue
    rm -rf "$EXTERNAL_DIR/$file"
done

echo ""
echo "=== Formatting external files ==="
pnpm format "$EXTERNAL_DIR" -r --save -q

echo ""
echo "=== Checking idempotency ==="
pnpm format "$EXTERNAL_DIR" -r --check -q

echo ""
echo "=== Resetting external repos (post-test) ==="
for repo in "$EXTERNAL_DIR"/*/; do
    git -C "$repo" checkout . 2>/dev/null || true
done

echo ""
echo "SUCCESS: External tests passed"
