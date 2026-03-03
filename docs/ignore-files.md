# Ignore Files

This project uses five ignore mechanisms. Each serves a different purpose: what goes into git, what ships in the VSIX, what gets linted, and what gets formatted.

## .gitignore

Controls what git tracks. Most build output is ignored; checked-in data JSONs are exceptions.

### Build output

| Pattern | What it ignores |
|---------|----------------|
| `client/out` | Client esbuild bundles (extension.js, webviews, etc.) |
| `server/out/*` | Server esbuild bundle, WASM files, generated runtime files |
| `cli/*/out` | CLI bundles (format-cli.js, transpile-cli.js, bin-cli.js) |
| `*.wasm` | Tree-sitter WASM files (built from C sources by `build:grammar`) |
| `coverage/` | Vitest coverage reports |

### Checked-in data (exceptions to `server/out/*`)

These JSON files are generated from `server/data/*.yml` by `generate-data.sh` but are checked in so that tests and typechecks work on a clean checkout without a build step.

| Pattern | Contents |
|---------|----------|
| `!server/out/completion.*.json` | Autocomplete item lists (one per language) |
| `!server/out/hover.*.json` | Hover documentation (one per language) |
| `!server/out/signature.*.json` | Signature help parameter hints |
| `!server/out/engine-proc-docs.json` | Engine procedure docs for the TSSL TypeScript plugin |

### Generated source

| Pattern | What it ignores |
|---------|----------------|
| `grammars/*/src/` | Tree-sitter generated C parser sources |
| `server/src/weidu-tp2/tree-sitter.d.ts` | Generated TypeScript types for TP2 grammar nodes |

### Third-party and temporary

| Pattern | What it ignores |
|---------|----------------|
| `node_modules` | pnpm dependencies (root, client, server, cli workspaces) |
| `client/node_modules`, `server/node_modules` | Workspace-specific node_modules |
| `external/*` | Cloned third-party mod repos used as test fixtures |
| `.vscode-test/` | Downloaded VSCode binaries for E2E tests |
| `tmp` | Scratch directory |
| `/test` | Root-level test directory |
| `.reports/` | Analysis reports |
| `*.log`, `*.vsix` | Log files and built extension packages |

The `external/` directory has four allowlisted text files (`!external/fallout.txt`, etc.) that list which repos to clone and what to exclude.

## .vscodeignore

Controls what ships in the VSIX extension package. Uses an **allowlist** strategy: `**/*` ignores everything, then `!` patterns include only what's needed.

### Client runtime

| Pattern | File | Purpose |
|---------|------|---------|
| `!client/package.json` | Package metadata | Required by VSCode |
| `!client/out/extension.js` | Main entry point | Extension activation |
| `!client/out/dialog-tree/dialogTree-webview.js` | Dialog tree webview | Renders dialog trees in a webview panel |
| `!client/out/editors/binaryEditor-webview.js` | Binary editor webview | Renders .pro files in a custom editor |

### Server runtime

| Pattern | File | Purpose |
|---------|------|---------|
| `!server/package.json` | Package metadata | Required by VSCode |
| `!server/out/server.js` | LSP server bundle | All server code bundled by esbuild |
| `!server/out/completion.*.json` | Completion data | Static autocomplete items from YAML |
| `!server/out/hover.*.json` | Hover data | Documentation shown on hover |
| `!server/out/signature.*.json` | Signature data | Parameter hints |
| `!server/out/engine-proc-docs.json` | Engine proc docs | Hover docs for TSSL TS plugin |
| `!server/out/td-runtime.d.ts` | TD runtime types | Injected into .td projects by td-plugin |
| `!server/out/*.wasm` | Tree-sitter parsers | Loaded at runtime for AST parsing |

### Runtime dependencies

| Pattern | Purpose |
|---------|---------|
| `!server/node_modules/sslc-emscripten-noderawfs/**` | Fallout SSL compiler (WASM). Loaded at runtime, cannot be bundled. |
| `!node_modules/bgforge-tssl-plugin/**` | TypeScript plugin for .tssl files. Installed to root node_modules by build script, loaded by tsserver. |
| `!node_modules/bgforge-td-plugin/**` | TypeScript plugin for .td files. Same mechanism as tssl-plugin. |

### Static assets

| Pattern | Purpose |
|---------|---------|
| `!language-configurations/*.json` | VSCode language configuration (brackets, comments, etc.) |
| `!snippets/*.json` | Code snippets |
| `!syntaxes/*.json` | TextMate grammars for syntax highlighting |
| `!themes/bgforge-icon-theme.json` | File icon theme |
| `!themes/bgforge-monokai.json` | Color theme |
| `!themes/seti.woff` | Icon font |
| `!themes/icons/*.png`, `!themes/icons/*.svg` | File type icons |
| `!LICENSE.txt` | License |
| `!resources/bgforge.png` | Extension icon |

## .prettierignore

Controls what prettier formats. Excludes generated/binary/data files that should not be reformatted.

| Pattern | Why excluded |
|---------|-------------|
| `syntaxes/*.*`, `themes/*.*` | Generated/structured JSON, not hand-written |
| `language-configurations/*.json` | Structured JSON maintained manually but not reformatted |
| `server/data/*.yml` | YAML data files with specific formatting conventions |
| `client/out`, `server/out/*` | Build output |
| `client/node_modules`, `server/node_modules`, `node_modules` | Dependencies |
| `external` | Third-party code |
| `.vscode-test/` | Downloaded VSCode binaries |
| `tmp` | Scratch directory |
| `**/pnpm-lock.yaml` | Machine-generated lockfiles |
| `*.log`, `*.vsix` | Non-source files |

## eslint.config.mjs (ignores section)

Controls what eslint skips. Defined inline in the flat config.

| Pattern | Why excluded |
|---------|-------------|
| `node_modules/**`, `client/node_modules/**`, `server/node_modules/**`, `cli/**/node_modules/**` | Dependencies |
| `client/out/**`, `server/out/**`, `cli/**/out/**` | Build output |
| `server/src/weidu-tp2/tree-sitter.d.ts` | Auto-generated from grammar |
| `server/src/weidu-baf/tree-sitter.d.ts` | Auto-generated from grammar |
| `server/src/weidu-d/tree-sitter.d.ts` | Auto-generated from grammar |
| `server/src/td/td-runtime.d.ts` | Runtime declarations with intentional `any` types |
| `grammars/**` | Tree-sitter grammars (JavaScript, not TypeScript; have their own lint config) |

## Grammar .gitignore files

Each grammar directory (`grammars/fallout-ssl/`, `grammars/weidu-baf/`, `grammars/weidu-d/`, `grammars/weidu-tp2/`) has its own `.gitignore` for test artifacts.

All grammar `.gitignore` files exclude:

| Pattern | Purpose |
|---------|---------|
| `test/samples-formatted/` | Temporary output from format tests (compared against `test/samples-expected/` which IS committed) |
| `test/samples-formatted-2/` | Second-pass format output for idempotency testing |

The `fallout-ssl` grammar has additional ignores for tree-sitter's multi-language build artifacts (Rust, Go, Python, Swift, Zig, C compiled objects, etc.) since it serves as the primary grammar development workspace.
