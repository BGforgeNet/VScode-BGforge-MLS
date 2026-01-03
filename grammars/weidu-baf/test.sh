#!/bin/bash
set -e

echo "Testing BAF formatter..."

# Test parsing samples
for f in test/samples/*.baf; do
    echo "Formatting: $f"
    node ../../server/out/format-cli.js "$f"
    echo "---"
done

echo "All BAF samples formatted successfully"
