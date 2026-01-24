#!/bin/bash

# Regenerates corpus test AST sections to match current grammar output
# Preserves test names and source code, only updates AST sections

set -eu -o pipefail

cd "$(dirname "$0")"

for corpus_file in test/corpus/*.txt; do
    echo "Processing $corpus_file..."

    # Create a temp file to store the regenerated content
    temp_file=$(mktemp)

    # Read the corpus file line by line
    in_source=false
    in_ast=false
    source_buffer=""

    while IFS= read -r line || [ -n "$line" ]; do
        # Detect separator line (80 equals signs)
        if [[ "$line" =~ ^=+$ ]]; then
            # Start of a new test
            echo "$line" >> "$temp_file"
            in_source=false
            in_ast=false
            source_buffer=""
        # Detect AST separator (80 dashes)
        elif [[ "$line" =~ ^-+$ ]]; then
            # End of source, start of AST
            # Parse the source buffer and write AST
            echo "$line" >> "$temp_file"
            echo "" >> "$temp_file"

            if [ -n "$source_buffer" ]; then
                # Write source to temp file and parse
                temp_source=$(mktemp --suffix=.tp2)
                printf "%s" "$source_buffer" > "$temp_source"
                ../../node_modules/.bin/tree-sitter parse --no-ranges "$temp_source" >> "$temp_file" 2>&1 || true
                rm "$temp_source"
                echo "" >> "$temp_file"
            fi

            in_ast=true
            in_source=false
        elif $in_ast; then
            # Skip old AST content until next test or EOF
            :
        elif [ -z "$line" ] && ! $in_source; then
            # Empty line before source starts
            echo "$line" >> "$temp_file"
            in_source=true
            source_buffer=""
        elif $in_source && [[ ! "$line" =~ ^-+$ ]]; then
            # Accumulate source code
            if [ -n "$source_buffer" ]; then
                source_buffer+=$'\n'
            fi
            source_buffer+="$line"
            echo "$line" >> "$temp_file"
        else
            # Test name or other content
            echo "$line" >> "$temp_file"
        fi
    done < "$corpus_file"

    # Replace original file with regenerated one
    mv "$temp_file" "$corpus_file"
    echo "✓ Regenerated $corpus_file"
done

echo "Done!"
