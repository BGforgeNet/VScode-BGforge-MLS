#!/bin/bash
set -e

eslint client/src/*.ts client/src/parsers/*.ts client/src/editors/*.ts --max-warnings 0
eslint client/src/test/*.ts --max-warnings 0
eslint server/src/*.ts --max-warnings 0
prettier --check client/src/editors/*.css client/src/editors/*.html
