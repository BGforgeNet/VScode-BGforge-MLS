#!/bin/bash

set -e

# Typecheck and lint all CLI code.
tsc --project cli/tsconfig.json

pnpm exec oxlint cli/**/*.ts \
    --ignore-pattern 'cli/test' \
    --ignore-pattern 'cli/vitest.config.ts'
