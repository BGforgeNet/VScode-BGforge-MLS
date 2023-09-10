#!/bin/bash

set -xeu -o pipefail

rm -rf node_modules ./*/node_modules
rm -f package-lock.json ./*/package-lock.json
rm -f pnpm-lock.yaml ./*/pnpm-lock.yaml

pnpm install
