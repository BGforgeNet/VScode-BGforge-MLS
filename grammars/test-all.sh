#!/bin/bash

# Run tests for all tree-sitter grammars. Delegates to the centralized test runner.

exec "$(dirname "$0")/../scripts/test-grammars.sh"
