#!/bin/bash

set -e

# Typecheck and lint scripts/ utility code.
tsc --project scripts/tsconfig.json

eslint scripts/*/src/**/*.ts scripts/*/test/**/*.ts \
  --no-warn-ignored \
  --max-warnings 0
