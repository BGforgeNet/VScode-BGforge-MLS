#!/bin/bash

# Lint all project-owned shell scripts with shellcheck.
set -eu -o pipefail

cd "$(dirname "$0")/.."

find . -name '*.sh' \
    -not -path './external/*' \
    -not -path './node_modules/*' \
    -not -path './.vscode-test/*' \
    -print0 | xargs -0 shellcheck -x
