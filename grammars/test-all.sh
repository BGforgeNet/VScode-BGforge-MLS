#!/bin/bash

cd /home/magi/data/work/sexydev/f2/vscode-mls/grammars

for grammar in fallout-ssl weidu-baf weidu-d; do
  echo "=== Testing $grammar ==="
  cd $grammar
  ./test.sh 2>&1 | grep -E "^(SUCCESS|OK:)" | tail -2
  cd ..
  echo ""
done
