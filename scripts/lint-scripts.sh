#!/bin/bash

set -e

# Typecheck and lint scripts/ utility code.
tsc --project scripts/tsconfig.json

pnpm exec oxlint scripts/*/src/**/*.ts scripts/*/test/**/*.ts
