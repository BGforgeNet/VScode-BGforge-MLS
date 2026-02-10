#!/bin/bash

set -e

# Typecheck and lint all CLI code.
tsc --project cli/tsconfig.json

eslint cli/**/*.ts \
  --ignore-pattern 'cli/test' \
  --ignore-pattern 'cli/vitest.config.ts' \
  --no-warn-ignored \
  --max-warnings 0
