# Scripts

See also: [CONTRIBUTING.md](../CONTRIBUTING.md) | [docs/architecture.md](../docs/architecture.md)

## Main commands

| Command              | Description                                           |
| -------------------- | ----------------------------------------------------- |
| `pnpm build`         | Build client, server, webviews, TS plugin, CLIs       |
| `pnpm build:all`     | Build everything including tree-sitter grammars       |
| `pnpm test`          | Run all tests including integration (see `test.sh`)   |
| `pnpm test:e2e`      | E2E tests (requires `pnpm build` first and host Electron libraries) |
| `pnpm test:grammars` | Grammar tests (generate, lint, corpus, parse, format) |
| `pnpm package`       | Create VSIX package                                   |

### Excluded from `pnpm build`

- **Grammars** (`pnpm build:grammar`) -- too slow for regular dev. Use `pnpm build:all` to include them, or run `pnpm build:grammar` separately.

### Excluded from `pnpm test`

- **Grammars** (`pnpm test:grammars`) -- slow. Run separately.
- **E2E** (`pnpm test:e2e`) -- requires a built extension, a VSCode instance, and host Electron libraries.

### Excluded from `server/pnpm test:unit`

- **Smoke test** (`test/smoke-stdio.test.ts`) -- requires a built server bundle (`pnpm build:base:server`). Run as part of `pnpm test` instead, which builds the bundle first.
- **Integration tests** (`test/integration/`) -- require external repos cloned via `pnpm test:external`. Run standalone with `cd server && pnpm test:integration`, or as part of `pnpm test` (which clones repos first).

## Temporary Artifacts

Store transient logs, generated scratch files, and test temp directories under the repo-level `tmp/` directory.

Avoid writing temporary data into source and fixture trees such as `server/test/`, `cli/test/`, `scripts/**`, or `grammars/**`.

## Running individual tests

```bash
# Server unit tests (vitest)
cd server && pnpm test:unit                              # All unit tests
cd server && pnpm exec vitest run test/td.test.ts        # Single file
cd server && pnpm exec vitest run --coverage             # With coverage

# Server integration tests (real fixtures from external repos)
cd server && pnpm test:integration                       # All integration tests

# TD/TBAF sample integration
bash server/test/td/test.sh                # Transpile .td samples, compare to expected .d
bash server/test/td/typecheck-samples.sh   # Type-check .td samples

# Single grammar
cd grammars/weidu-tp2 && pnpm test         # Test one grammar (any grammars/*/)

# CLI tests
pnpm test:cli                              # Exit codes and diff output
```

## Scripts in this directory

| Script                   | Description                                                                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test.sh`                | Main test suite run by `pnpm test`. Typechecks client/server/CLI, runs Oxlint, server unit tests, client tests, TD/TBAF sample tests, formatting checks, CLI tests, binary parser tests, integration tests, and knip. |
| `test-grammars.sh`       | Run all grammar test suites (calls `test-grammar.sh` per grammar).                                                                                                                              |
| `test-grammar.sh`        | Test a single grammar (generate, lint, corpus, highlight, parse, format, compare, idempotency).                                                                                                 |
| `test-bin.sh`            | Binary parser tests.                                                                                                                                                                            |
| `test-external.sh`       | Clone external repos and run format/idempotency tests against them. Also provides fixtures for integration tests.                                                                               |
| `test-e2e.sh`            | E2E test runner.                                                                                                                                                                                |
| `build-grammar.sh`       | Build all tree-sitter grammars to WASM.                                                                                                                                                         |
| `build-base-server.sh`   | esbuild bundle for the LSP server. Uses `--banner`/`--define` for import.meta.url patching.                                                                                                     |
| `build-base-client.sh`   | esbuild bundle for the client. Copies codicons font assets to `client/out/codicons/`.                                                                                                           |
| `build-base-webviews.sh` | esbuild bundle for webview scripts (dialog tree, binary editor).                                                                                                                                |
| `build-dev.sh`           | Minimal build for F5 development (skips CLIs, linting, tests).                                                                                                                                  |
| `build-test.sh`          | esbuild bundle for E2E test files.                                                                                                                                                              |
| `build-format-cli.sh`    | esbuild bundle for the format CLI. Same `--banner`/`--define` pattern as server.                                                                                                                |
| `build-transpile-cli.sh` | esbuild bundle for the transpile CLI. Same `--banner`/`--define` pattern as server.                                                                                                             |
| `build-bin-cli.sh`       | esbuild bundle for the binary parser CLI.                                                                                                                                                       |
| `build-ts-plugin.sh`     | esbuild bundle for the TSSL TypeScript plugin.                                                                                                                                                  |
| `build-td-plugin.sh`     | esbuild bundle for the TD TypeScript plugin.                                                                                                                                                    |
| `build-editors.sh`       | Build editor-specific syntax bundles: TextMate (.tmbundle.zip), Kate KSH (.xml), Notepad++ UDL (.xml), Geany (.conf).                                                                           |
| `package.sh`             | Create VSIX. Replaces pnpm symlinks with real copies for vsce, restores after via EXIT trap.                                                                                                    |
| `prepublish.sh`          | Pre-publish hook run by vsce before packaging.                                                                                                                                                  |
| `publish-server.sh`      | Publish `@bgforge/mls-server` to npm.                                                                                                                                                          |
| `test-package-deps.ts`   | Validates .vscodeignore whitelist against build scripts, source paths, and package.json contributes.                                                                                            |
| `vitest.config.ts`       | Vitest configuration for script-level tests.                                                                                                                                                    |
| `vitest.smoke.config.ts` *(server/)* | Vitest configuration for the server smoke test (separate because it requires a built bundle).                                                                                   |
| `generate-data.sh`       | Generate YAML data files from game engine sources.                                                                                                                                              |
| `regenerate-expected.sh` | Regenerate tree-sitter grammar sources and types.                                                                                                                                               |
| `grammar-test-lib.sh`    | Shared helpers for grammar tests.                                                                                                                                                               |
| `preview-highlight.sh`   | Preview tree-sitter highlight output for a grammar's files. Usage: `preview-highlight.sh <grammar-name> [file]`.                                                                                |
| `syntaxes-to-json.sh`    | Convert TextMate grammars from YAML to JSON.                                                                                                                                                    |
| `lint-cli.sh`            | Lint CLI source files.                                                                                                                                                                          |
| `lint-scripts.sh`        | Lint script utility source files.                                                                                                                                                               |
| `lint-shell.sh`          | Lint shell scripts (shellcheck).                                                                                                                                                                |
| `fallout-update.sh`      | Update Fallout engine data.                                                                                                                                                                     |
| `ie-update.sh`           | Update Infinity Engine data.                                                                                                                                                                    |
