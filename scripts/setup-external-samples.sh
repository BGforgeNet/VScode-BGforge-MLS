#!/bin/bash

# Setup external D samples from Ascension repository
# Clones Ascension repo and copies all .d files to test sample directories

set -e

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

REPO_URL="https://github.com/Gibberlings3/Ascension.git"
COMMIT="870ac8ac94c4ee2638ddf32fd1b243df05b80b5b"
EXTERNAL_DIR="$ROOT/external/ie/ascension"
GRAMMAR_SAMPLES="$ROOT/grammars/weidu-d/test/samples"

echo "=== Setting up external D samples from Ascension ==="

# Create external directory if needed
mkdir -p "$ROOT/external/ie"

# Clone or update repository
if [[ ! -d "$EXTERNAL_DIR" ]]; then
    echo "Cloning Ascension repository..."
    git clone "$REPO_URL" "$EXTERNAL_DIR"
    cd "$EXTERNAL_DIR"
    git checkout "$COMMIT"
else
    echo "Ascension repository exists, checking out commit $COMMIT..."
    cd "$EXTERNAL_DIR"
    git fetch origin
    git checkout "$COMMIT"
fi

echo "Finding all .d files in Ascension repository..."
D_FILES=$(find "$EXTERNAL_DIR" -type f -name "*.d" 2>/dev/null || true)
COUNT=$(echo "$D_FILES" | grep -c . || echo "0")

if [[ $COUNT -eq 0 ]]; then
    echo "WARNING: No .d files found in Ascension repository"
    exit 0
fi

echo "Found $COUNT .d files"

# Copy to grammar samples (for parsing tests only, not formatter regression)
echo "Copying to grammar samples directory..."
for file in $D_FILES; do
    basename=$(basename "$file")
    # Prefix with ascension_ to avoid name conflicts
    cp "$file" "$GRAMMAR_SAMPLES/ascension_$basename"
done

echo "Successfully copied $COUNT .d files to grammar samples directory"
echo "Files are prefixed with 'ascension_' to avoid conflicts"
echo "Note: Not copying to TD samples-expected (no .td inputs for these files)"
