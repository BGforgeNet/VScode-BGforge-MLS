#!/bin/bash

# Run tests for all tree-sitter grammars.

cd /home/magi/data/work/sexydev/f2/vscode-mls/grammars || exit

for grammar in fallout-ssl weidu-baf weidu-d; do
  echo "=== Testing $grammar ==="
  (
    cd "$grammar" || exit
    ./test.sh 2>&1 | grep -E "^(SUCCESS|OK:)" | tail -2
  )
  echo ""
done
