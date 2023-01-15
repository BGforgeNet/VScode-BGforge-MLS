#!/bin/bash

set -xeu -o pipefail

deactivate >/dev/null 2>&1 || true
rm -rf .venv
virtualenv .venv
set +x
# shellcheck source=/dev/null
source .venv/bin/activate
pip install -r scripts/requirements.txt
pip install -r scripts/requirements-dev.txt
