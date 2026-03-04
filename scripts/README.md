# Scripts

See also: [development.md](../development.md) | [docs/architecture.md](../docs/architecture.md)

## Main commands

| Command              | Description                                           |
| -------------------- | ----------------------------------------------------- |
| `pnpm build`         | Build client, server, webviews, TS plugin, CLIs       |
| `pnpm build:all`     | Build everything including tree-sitter grammars       |
| `pnpm test`          | Run all tests (see `test.sh` below)                   |
| `pnpm test:e2e`      | E2E tests (requires `pnpm build` first)               |
| `pnpm test:grammars` | Grammar tests (generate, lint, corpus, parse, format) |
| `pnpm package`       | Create VSIX package                                   |

### Excluded from `pnpm build`

- **Grammars** (`pnpm build:grammar`) -- too slow for regular dev. Use `pnpm build:all` to include them, or run `pnpm build:grammar` separately.

### Excluded from `pnpm test`

- **Grammars** (`pnpm test:grammars`) -- slow. Run separately.
- **E2E** (`pnpm test:e2e`) -- requires a built extension and a VSCode instance.
- **Format samples** are partially covered via TD/TBAF sample tests. Full format sample tests: `pnpm test:format-samples`.

## Running individual tests

```bash
# Server unit tests (vitest)
cd server && pnpm test:unit                              # All unit tests
cd server && pnpm exec vitest run test/td.test.ts        # Single file
cd server && pnpm exec vitest run --coverage             # With coverage

# TD/TBAF sample integration
bash server/test/td/test.sh                # Transpile .td samples, compare to expected .d
bash server/test/td/typecheck-samples.sh   # Type-check .td samples

# Single grammar
bash grammars/weidu-tp2/test.sh            # Test one grammar (any grammars/*/test.sh)

# Format samples
pnpm test:format-samples                   # Format comparison + idempotency

# CLI tests
pnpm test:cli                              # Exit codes and diff output
```

## Scripts in this directory

| Script                   | Description                                                                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test.sh`                | Main test suite run by `pnpm test`. Typechecks client/server/CLI, runs ESLint, server and client unit tests, TD/TBAF sample tests, formatting checks, CLI tests, binary parser tests, and knip. |
| `test-grammars.sh`       | Run all grammar test suites (calls `test-grammar.sh` per grammar).                                                                                                                              |
| `test-grammar.sh`        | Test a single grammar (generate, lint, corpus, parse, format).                                                                                                                                  |
| `test-format-samples.sh` | Format comparison and idempotency tests.                                                                                                                                                        |
| `test-bin.sh`            | Binary parser tests.                                                                                                                                                                            |
| `test-external.sh`       | Tests against external repositories (not run by `pnpm test`).                                                                                                                                   |
| `test-e2e.sh`            | E2E test runner.                                                                                                                                                                                |
| `build-grammar.sh`       | Build all tree-sitter grammars to WASM.                                                                                                                                                         |
| `build-base-server.sh`   | esbuild bundle for the LSP server. Uses `--banner`/`--define` for import.meta.url patching.                                                                                                     |
| `build-base-client.sh`   | esbuild bundle for the client. Copies codicons font assets to `client/out/codicons/`.                                                                                                           |
| `build-format-cli.sh`    | esbuild bundle for the format CLI. Same `--banner`/`--define` pattern as server.                                                                                                                |
| `build-transpile-cli.sh` | esbuild bundle for the transpile CLI. Same `--banner`/`--define` pattern as server.                                                                                                             |
| `package.sh`             | Create VSIX. Replaces pnpm symlinks with real copies for vsce, restores after via EXIT trap.                                                                                                    |
| `test-package-deps.ts`   | Validates .vscodeignore whitelist against build scripts, source paths, and package.json contributes.                                                                                            |
| `generate-data.sh`       | Generate YAML data files from game engine sources.                                                                                                                                              |
| `regenerate-expected.sh` | Regenerate tree-sitter grammar sources and types.                                                                                                                                               |
| `grammar-test-lib.sh`    | Shared helpers for grammar tests.                                                                                                                                                               |
| `syntaxes-to-json.sh`    | Convert TextMate grammars from YAML to JSON.                                                                                                                                                    |
| `format-samples.sh`      | Run formatter on sample files.                                                                                                                                                                  |
| `fallout-update.sh`      | Update Fallout engine data.                                                                                                                                                                     |
| `ie-update.sh`           | Update Infinity Engine data.                                                                                                                                                                    |
