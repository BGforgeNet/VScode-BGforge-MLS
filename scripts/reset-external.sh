#!/bin/bash

# Reset all external repos to their committed state (git checkout .).
# Used before tests that read external files, and for manual cleanup.

set -eu -o pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

for dir in "$ROOT_DIR"/external/fallout/*/ "$ROOT_DIR"/external/infinity-engine/*/; do
    if [[ -d "$dir/.git" ]]; then
        git -C "$dir" checkout . 2>/dev/null || true
    fi
done

echo "External repos reset"
