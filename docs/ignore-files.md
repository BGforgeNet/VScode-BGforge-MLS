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

### Why allowlist, not blocklist

A blocklist approach (exclude `node_modules/`, `src/`, etc.) is fragile: new directories, temp files, caches, or large binaries silently leak into the VSIX. In this project, `external/` alone is ~70 MB and `.venv` would add more. An allowlist guarantees only explicitly approved files ship. The tradeoff is that new runtime files must be added to `.vscodeignore` manually, but `scripts/test-package-deps.ts` catches omissions automatically (see [Packaging validation](#packaging-validation) below).

### Client runtime

| Pattern | Purpose |
|---------|---------|
| `!client/package.json` | Package metadata, required by VSCode |
| `!client/out/extension.js` | Main entry point, extension activation |
| `!client/out/dialog-tree/dialogTree-webview.js` | Dialog tree webview bundle |
| `!client/out/editors/binaryEditor-webview.js` | Binary editor webview bundle |
| `!client/out/codicons/codicon.css` | Codicons stylesheet for webviews |
| `!client/out/codicons/codicon.ttf` | Codicons font file for webviews |

### Client static assets (webviews)

| Pattern | Purpose |
|---------|---------|
| `!client/src/dialog-tree/dialogTree.html` | Dialog tree webview HTML template |
| `!client/src/dialog-tree/dialogTree.css` | Dialog tree webview styles |
| `!client/src/editors/binaryEditor.html` | Binary editor webview HTML template |
| `!client/src/editors/binaryEditor.css` | Binary editor webview styles |
| `!client/src/webview-common.css` | Shared webview styles |

### Server runtime

| Pattern | Purpose |
|---------|---------|
| `!server/package.json` | Package metadata, required by VSCode |
| `!server/out/server.js` | LSP server bundle (all server code bundled by esbuild) |
| `!server/out/completion.*.json` | Static autocomplete items from YAML |
| `!server/out/hover.*.json` | Hover documentation from YAML |
| `!server/out/signature.*.json` | Signature help parameter hints |
| `!server/out/engine-proc-docs.json` | Engine procedure hover docs for TSSL TS plugin |
| `!server/out/td-runtime.d.ts` | TD runtime types, injected into .td projects by td-plugin |
| `!server/out/*.wasm` | Tree-sitter WASM parsers, loaded at runtime |

### Runtime dependencies (node_modules)

**sslc compiler** (all files needed):

| Pattern | Purpose |
|---------|---------|
| `!server/node_modules/sslc-emscripten-noderawfs/**` | Fallout SSL compiler (WASM). Loaded at runtime via `fork()`, cannot be bundled. |

**esbuild-wasm** (selective — browser/ESM/typings excluded):

| Pattern | Purpose |
|---------|---------|
| `!server/node_modules/esbuild-wasm/package.json` | Module resolution |
| `!server/node_modules/esbuild-wasm/esbuild.wasm` | WASM binary |
| `!server/node_modules/esbuild-wasm/lib/main.js` | Node.js CJS entry point |
| `!server/node_modules/esbuild-wasm/bin/esbuild` | CLI launcher (spawned by lib/main.js) |
| `!server/node_modules/esbuild-wasm/wasm_exec.js` | Go WASM runtime |
| `!server/node_modules/esbuild-wasm/wasm_exec_node.js` | Node.js WASM shim |

Excluded: `lib/browser*`, `esm/*`, `*.d.ts`, `README.md`, `LICENSE.md` (browser bundles, TypeScript types, and docs are not needed at runtime).

**TypeScript plugins** (selective — source maps excluded):

| Pattern | Purpose |
|---------|---------|
| `!node_modules/bgforge-tssl-plugin/package.json` | Module resolution |
| `!node_modules/bgforge-tssl-plugin/index.js` | Plugin bundle for .tssl files |
| `!node_modules/bgforge-td-plugin/package.json` | Module resolution |
| `!node_modules/bgforge-td-plugin/index.js` | Plugin bundle for .td files |

Note: `server/node_modules/` entries are pnpm symlinks. `scripts/package.sh` replaces them with real copies before packaging (vsce doesn't follow symlinks) and restores them after. Root `node_modules/` entries are created by vsce's own `npm install` during packaging (this is why `--no-dependencies` is not used).

### Static assets

| Pattern | Purpose |
|---------|---------|
| `!language-configurations/*.json` | VSCode language configuration (brackets, comments, etc.) |
| `!snippets/*.json` | Code snippets |
| `!syntaxes/*.json` | TextMate grammars for syntax highlighting |
| `!themes/bgforge-icon-theme.json` | File icon theme definition |
| `!themes/bgforge-monokai.json` | Color theme |
| `!themes/seti.woff` | Icon font |
| `!themes/icons/*.png`, `!themes/icons/*.svg` | File type icons |
| `!LICENSE.txt` | License |
| `!resources/bgforge.png` | Extension icon |

### Packaging validation

`scripts/test-package-deps.ts` runs as part of `pnpm test` and catches missing `.vscodeignore` entries automatically with 5 checks:

1. **esbuild externals** -- every `--external:pkg` in build scripts must have a `node_modules/pkg` entry
2. **Runtime file paths** -- `path.join`/`Uri.joinPath` calls in source with `"client"`/`"server"` segments must match a whitelist pattern
3. **Pattern resolution** -- every whitelist pattern must match at least one existing file (catches stale entries)
4. **`__dirname` node_modules** -- `__dirname`-relative `node_modules/` paths in source (e.g., sslc `fork()`) must have a matching entry
5. **package.json contributes** -- all file paths in `contributes` (grammars, snippets, themes, language configs, TS plugins, icon, main) must match a whitelist pattern

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
