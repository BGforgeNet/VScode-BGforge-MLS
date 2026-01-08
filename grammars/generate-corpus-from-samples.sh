#!/bin/bash
# Generate corpus tests from sample files by parsing them and capturing AST
# Usage: Run from within a grammar directory (e.g., grammars/weidu-d/)

set -eu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GRAMMAR_DIR="${1:-.}"

cd "$GRAMMAR_DIR"

# Detect file extension from samples directory
if [ ! -d "test/samples" ]; then
    echo "Error: test/samples directory not found in $GRAMMAR_DIR"
    exit 1
fi

# Get first sample file to detect extension
SAMPLE_FILE=$(ls test/samples/* 2>/dev/null | head -1)
if [ -z "$SAMPLE_FILE" ]; then
    echo "Error: No sample files found in test/samples/"
    exit 1
fi

EXT="${SAMPLE_FILE##*.}"
echo "Detected file extension: .$EXT"

OUTPUT_FILE="test/corpus/samples.txt"
mkdir -p test/corpus
> "$OUTPUT_FILE"  # Clear file

for f in test/samples/*.$EXT; do
    basename=$(basename "$f" .$EXT)

    echo "Adding corpus test: $basename"

    # Add separator and test name
    echo "================================================================================" >> "$OUTPUT_FILE"
    echo "$basename" >> "$OUTPUT_FILE"
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
