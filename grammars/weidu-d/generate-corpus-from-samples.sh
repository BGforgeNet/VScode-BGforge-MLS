#!/bin/bash
# Generate corpus tests from sample files by parsing them and capturing AST

set -eu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

OUTPUT_FILE="test/corpus/ascension.txt"
> "$OUTPUT_FILE"  # Clear file

for f in test/samples/ascension_*.d; do
    basename=$(basename "$f" .d)
    # Remove ascension_ prefix for test name
    testname=${basename#ascension_}

    echo "Adding corpus test: $testname"

    # Add separator and test name
    echo "================================================================================" >> "$OUTPUT_FILE"
    echo "$testname" >> "$OUTPUT_FILE"
    echo "================================================================================" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"

    # Add source code
    cat "$f" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"

    # Add separator
    echo "--------------------------------------------------------------------------------" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"

    # Add AST (without position info)
    tree-sitter parse --no-ranges "$f" >> "$OUTPUT_FILE" 2>&1
    echo "" >> "$OUTPUT_FILE"
done

echo "Generated corpus tests in $OUTPUT_FILE"
