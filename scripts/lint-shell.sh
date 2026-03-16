#!/bin/bash

# Lint all project-owned shell scripts with shellcheck.
# Uses git ls-files to automatically respect .gitignore exclusions.
set -eu -o pipefail

cd "$(dirname "$0")/.."

# git ls-files respects .gitignore automatically
# -c: include cached/tracked files
# -o: include other/untracked files (but still respect .gitignore)
# --exclude-standard: use standard git exclude rules
git ls-files -co --exclude-standard '*.sh' | xargs shellcheck -x
