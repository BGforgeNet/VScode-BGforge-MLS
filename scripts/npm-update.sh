#!/bin/bash

set -xeu -o pipefail

rm -rf node_modules client/node_modules server/node_modules
rm -rf package-lock.json client/package-lock.json server/package-lock.json

npm install
