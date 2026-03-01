# Architecture

See also: [development.md](../development.md) | [server/README.md](../server/README.md) | [scripts/README.md](../scripts/README.md)

High-level architecture of the BGforge MLS extension. For server-specific details
(provider registry, symbol system, data flow), see [server/README.md](../server/README.md).

## Table of Contents

- [System Overview](#system-overview)
- [Repository Layout](#repository-layout)
- [Build System](#build-system)
  - [Build Targets](#build-targets)
  - [Build Pipeline](#build-pipeline)
  - [Key Build Constraints](#key-build-constraints)
- [Client Architecture](#client-architecture)
  - [Extension Activation](#extension-activation)
  - [TypeScript Language Service Plugins](#typescript-language-service-plugins)
  - [Webview Panels](#webview-panels)
- [Server Architecture](#server-architecture)
  - [Providers](#providers)
  - [Transpilers](#transpilers)
- [CLI Tools](#cli-tools)
  - [Format CLI](#format-cli)
  - [Transpile CLI](#transpile-cli)
  - [Binary CLI](#binary-cli)
  - [Shared CLI Infrastructure](#shared-cli-infrastructure)
- [Grammar Architecture](#grammar-architecture)
  - [Tree-Sitter Grammars](#tree-sitter-grammars)
  - [TextMate Grammars](#textmate-grammars)
- [Data Pipeline](#data-pipeline)
- [Test Architecture](#test-architecture)
  - [Server Unit Tests](#server-unit-tests-servertest)
  - [Integration Tests](#integration-tests)
  - [E2E Tests](#e2e-tests)
- [Extension Packaging](#extension-packaging)
- [Key Design Decisions](#key-design-decisions)

## System Overview

```
+-------------------+       IPC        +-------------------+
|   VSCode Client   | <--------------> |    LSP Server     |
|  (extension.ts)   |                  |   (server.ts)     |
+-------------------+                  +-------------------+
        |                                      |
        |  TS Language Service                  v
        |  (tsserver process)          +-------------------+
        v                             | ProviderRegistry  |
+-------------------+                 +-------------------+
| bgforge-tssl-     |                         |
|   plugin/index.js |    +--------+--------+--+--------+---------+
| bgforge-td-       |    |        |        |           |         |
|   plugin/index.js |    v        v        v           v         v
+-------------------+  Fallout  WeiDU   WeiDU       WeiDU    Fallout
                        SSL      BAF      D          TP2     Worldmap

+-------------------+
|   CLI Tools       |   Standalone, reuse server modules
|  format-cli.js    |   No VSCode dependency
|  transpile-cli.js |
|  bin-cli.js       |
+-------------------+
```

Three runtime processes:

1. **VSCode Client** -- extension activation, commands, webview panels, binary editor
2. **LSP Server** -- language features (completion, hover, definition, format, etc.)
3. **tsserver** -- TypeScript Language Service plugins for `.tssl` and `.td` files

CLI tools run independently, reusing server modules directly.

## Repository Layout

```
vscode-mls/
|
+-- client/                 VSCode extension client
|   +-- src/
|   |   +-- extension.ts        Entry point (activate/deactivate, LSP client)
|   |   +-- ts-plugin.ts        TS plugin for .tssl (suppresses TS6133, engine hover)
|   |   +-- td-plugin.ts        TS plugin for .td (injects runtime, filters completions)
|   |   +-- filter-diagnostics.ts   Diagnostic filtering for TSSL plugin
|   |   +-- engine-proc-hover.ts    Engine procedure hover docs injection
|   |   +-- indicator.ts            Server initialization progress indicator
|   |   +-- dialog-tree/            Dialog tree preview (webview panels)
|   |   +-- editors/                Binary .pro file editor (custom editor)
|   |   +-- parsers/                Binary file parsers (.pro format)
|   |   +-- test/                   E2E tests (mocha + vscode test runner)
|   +-- out/                    esbuild output
|
+-- server/                 LSP server (see server/README.md for details)
|   +-- src/
|   |   +-- server.ts               LSP entry point, request handlers
|   |   +-- provider-registry.ts    Routes requests to language providers
|   |   +-- language-provider.ts    Provider interface
|   |   +-- compile.ts              Compilation dispatch
|   |   +-- translation.ts          .tra/.msg inlay hints and hover
|   |   +-- transpiler-utils.ts     Shared transpiler utilities
|   |   +-- safe-eval.ts            Safe expression evaluator (no eval())
|   |   +-- common.ts               Logging, file utilities
|   |   +-- settings.ts             User settings
|   |   +-- core/                   Symbol system, language IDs, patterns
|   |   +-- shared/                 Cross-provider utilities
|   |   +-- fallout-ssl/            Fallout SSL provider (full IDE support)
|   |   +-- fallout-worldmap/       Worldmap provider (completion + hover)
|   |   +-- weidu-baf/              WeiDU BAF provider (format + compile)
|   |   +-- weidu-d/                WeiDU D provider (symbols + definition)
|   |   +-- weidu-tp2/              WeiDU TP2 provider (full IDE support)
|   |   +-- tssl/                   TSSL transpiler (.tssl -> .ssl)
|   |   +-- tbaf/                   TBAF transpiler (.tbaf -> .baf)
|   |   +-- td/                     TD transpiler (.td -> .d)
|   +-- data/                   YAML data files (game engine definitions)
|   +-- test/                   Unit tests (vitest)
|   +-- out/                    esbuild output + WASM files + JSON data
|
+-- cli/                    Standalone CLI tools
|   +-- format/                 Format CLI (all languages)
|   +-- transpile/              Transpile CLI (TSSL, TBAF, TD)
|   +-- bin/                    Binary parser CLI (.pro -> JSON)
|   +-- cli-utils.ts            Shared CLI utilities
|   +-- test/                   CLI tests
|
+-- grammars/               Tree-sitter grammars (4 languages)
|   +-- fallout-ssl/            grammar.js, corpus tests, WASM output
|   +-- weidu-baf/
|   +-- weidu-d/
|   +-- weidu-tp2/
|
+-- syntaxes/               TextMate grammars (YAML source -> JSON)
|   +-- {lang}.tmLanguage.yml       Primary syntax highlighting
|   +-- {lang}-tooltip.tmLanguage.yml   Hover tooltip syntax
|   +-- bgforge-mls-*.tmLanguage.yml    Comment/string/docstring injection
|
+-- language-configurations/  VSCode language settings (brackets, comments, indent)
+-- themes/                 Color theme (BGforge Monokai) + icon theme
+-- snippets/               Code snippets (SSL, BAF, TP2)
+-- scripts/                Build, test, data generation scripts
+-- external/               Game data (Fallout, Infinity Engine)
+-- resources/              Extension icon
+-- docs/                   Documentation
```

## Build System

All bundles use **esbuild** (not tsc). The monorepo uses **pnpm workspaces**.

### Build Targets

| Target | Input | Output | Notes |
|--------|-------|--------|-------|
| Client | `client/src/extension.ts` | `client/out/extension.js` | CJS, `vscode` external |
| Server | `server/src/server.ts` | `server/out/server.js` | CJS, patches `import_meta` for WASM |
| TSSL Plugin | `client/src/ts-plugin.ts` | `node_modules/bgforge-tssl-plugin/index.js` | CJS, standalone |
| TD Plugin | `client/src/td-plugin.ts` | `node_modules/bgforge-td-plugin/index.js` | CJS, standalone |
| Webviews | `client/src/{dialog,binary}-webview.ts` | `client/out/*.js` | Browser context |
| Format CLI | `cli/format/src/cli.ts` | `cli/format/out/format-cli.js` | CJS + WASM files |
| Transpile CLI | `cli/transpile/src/cli.ts` | `cli/transpile/out/transpile-cli.js` | CJS |
| Binary CLI | `cli/bin/src/cli.ts` | `cli/bin/out/bin-cli.js` | CJS |
| Grammars | `grammars/*/grammar.js` | `grammars/*/*.wasm` -> `server/out/` | tree-sitter build --wasm |
| TextMate | `syntaxes/*.tmLanguage.yml` | `syntaxes/*.tmLanguage.json` | YAML -> JSON conversion |

### Build Pipeline

```
pnpm build
  |
  +-> build:client        esbuild client + TS plugins + bin CLI
  +-> build:server        esbuild server + CLIs + copy WASM to server/out/
  +-> build:test          esbuild E2E test bundles
  +-> build:webviews      esbuild webview bundles

pnpm build:all            (build:grammar + build)
pnpm build:dev            Minimal build for F5 development (skips CLIs)
```

### Key Build Constraints

1. **WASM patching**: web-tree-sitter uses `import.meta.url` for WASM loading.
   esbuild transforms this, breaking the path. Build scripts patch with `sed`.
2. **TS plugins**: Must be standalone CJS bundles in `node_modules/` directories.
   tsserver loads them by package name from `typescriptServerPlugins` in package.json.
3. **Externalized .d.ts imports**: Transpiler libraries (ielib, folib) use `.d.ts` for
   engine declarations. esbuild externalizes these; they pass through as bare identifiers.
   Libraries must use named re-exports, not `export *`.

## Client Architecture

### Extension Activation

The extension activates on language open or when the workspace contains transpiler files
(`.tssl`, `.tbaf`, `.td`). See `activationEvents` in package.json.

```
activate()
  |
  +-> Create LanguageClient (IPC transport to server)
  +-> Register commands (compile, dialog preview)
  +-> Register binary editor provider (.pro files)
  +-> Register dialog tree webview panels
  +-> Start server (server/out/server.js)
```

### TypeScript Language Service Plugins

Plugins intercept tsserver calls for transpiler files. They run inside the tsserver
process, not the extension host.

**TSSL Plugin** (`ts-plugin.ts`):
- Suppresses TS6133 ("declared but never read") for engine procedure names
- Appends engine procedure hover documentation from build-time generated JSON
- Proxies `getSemanticDiagnostics`, `getSuggestionDiagnostics`, `getQuickInfoAtPosition`

**TD Plugin** (`td-plugin.ts`):
- Injects `td-runtime.d.ts` into the project file list (no tsconfig needed)
- Excludes DOM lib to prevent browser types in completions
- Filters completions: blocks ES2020 lib names in `.td` files, blocks TD names in non-`.td` files
- Proxies `getCompletionsAtPosition`, overrides `getScriptFileNames`, `getCompilationSettings`

### Webview Panels

Two webview-based features, each with a host-side and browser-side module:

| Feature | Host Module | Webview Module | Trigger |
|---------|------------|---------------|---------|
| Dialog Tree (SSL) | `dialog-tree/dialogTree.ts` | `dialogTree-webview.ts` | Ctrl+Shift+V in SSL |
| Dialog Tree (D) | `dialog-tree/dialogTree-d.ts` | `dialogTree-webview.ts` | Ctrl+Shift+V in D |
| Binary Editor | `editors/binaryEditor.ts` | `binaryEditor-webview.ts` | Open .pro file |

## Server Architecture

See [server/README.md](../server/README.md) for comprehensive documentation covering:

- Provider registry pattern and request routing
- Symbol system (IndexedSymbol, scope hierarchy, pre-computed responses)
- Data flow (initialization, hover fallthrough, file change propagation)
- Tree-sitter integration (sequential init, SyntaxType enum, parse caching)
- Translation service (.tra/.msg inlay hints)
- Adding a new provider

### Providers

Each provider implements a subset of the `LanguageProvider` interface:

| Provider | Completion | Hover | Signature | Definition | Format | Symbols | Rename | Compile |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| fallout-ssl | x | x | x | x | x | x | x | sslc |
| fallout-worldmap | x | x | | | | | | |
| weidu-baf | x | x | | | x | | | weidu |
| weidu-d | x | x | | x | x | x | | weidu |
| weidu-tp2 | x | x | | x | x | x | x | weidu |

### Transpilers

Three TypeScript-to-scripting-language transpilers share a common pipeline:

```
Source (.tssl/.tbaf/.td)
  |
  +-> Extract @tra tag (esbuild strips comments)
  +-> Bundle imports (esbuild, shared bundler)
  +-> Parse AST (ts-morph)
  +-> Transform to IR (language-specific)
  +-> Emit target language text
  +-> Write output file
  +-> Optional: chain native compilation
```

**Shared utilities** (`transpiler-utils.ts`): variable substitution, loop unrolling
(max 1000 iterations), array spread/destructuring, helper fixups (obj/tra/tlk).

**Shared bundler** (`tbaf/bundle.ts`): esbuild with externalized `.d.ts` imports,
used by all three transpilers.

| Transpiler | Input | Output | Key Features |
|------------|-------|--------|-------------|
| TSSL | `.tssl` | `.ssl` | const/let, loops, functions, enum pre-transform |
| TBAF | `.tbaf` | `.baf` | for/for-of, arrays, spread, destructuring, function inlining |
| TD | `.td` | `.d` | All TBAF features + conditionals, method chains, transitive state collection, orphan warnings |

**TD module structure** (`server/src/td/`):

| Module | Purpose |
|--------|---------|
| `index.ts` | Entry point, bundling, orphan detection on original source |
| `parse.ts` | AST walker: ts-morph AST -> IR |
| `parse-helpers.ts` | Utility functions (evaluate, resolve, validate) |
| `expression-eval.ts` | Expression -> trigger/action/text conversion |
| `chain-parsing.ts` | Method chain transition parsing |
| `chain-processing.ts` | Chain body processing (from/fromWhen/say) |
| `state-transitions.ts` | State/transition processing, loop unrolling |
| `state-resolution.ts` | Post-parse BFS transitive collection, orphan detection |
| `patch-operations.ts` | Patch operation transforms (ALTER_TRANS, etc.) |
| `emit.ts` | IR -> D text serialization |
| `types.ts` | IR types (TDScript, TDConstruct, TDState, TDSay, etc.) |
| `td-runtime.d.ts` | TypeScript declarations for TD API |

## CLI Tools

Standalone command-line tools that reuse server modules without VSCode dependency.

### Format CLI

```
node format-cli.js <file|dir> [--save] [--check] [-r] [-q]
```

Formats Fallout SSL, WeiDU BAF/D/TP2 files using the same tree-sitter-based formatters
as the LSP server. Respects `.editorconfig`. Includes WASM parser modules.

### Transpile CLI

```
node transpile-cli.js <file|dir> [--save] [--check] [-r] [-q]
```

Transpiles `.tssl`, `.tbaf`, `.td` files to their target formats. Uses ts-morph
and esbuild-wasm. Reports orphan warnings for TD files.

### Binary CLI

```
node bin-cli.js <file.pro|dir> [--save] [--check] [-r] [-q]
```

Parses Fallout `.pro` binary files and outputs structured JSON.

### Shared CLI Infrastructure

`cli/cli-utils.ts` provides:
- Argument parsing (`--save`, `--check`, `-r`, `-q`)
- File discovery (single file or recursive directory scan)
- Diff reporting (colorized, for `--check` failures)
- Error handling wrapper

## Grammar Architecture

### Tree-Sitter Grammars

Four tree-sitter grammars compiled to WASM for in-browser parsing:

| Grammar | Language | Used By |
|---------|----------|---------|
| `fallout-ssl` | Fallout SSL (.ssl, .h) | fallout-ssl provider |
| `weidu-baf` | WeiDU BAF (.baf) | weidu-baf provider |
| `weidu-d` | WeiDU D (.d) | weidu-d provider |
| `weidu-tp2` | WeiDU TP2 (.tp2/.tpa/.tph/.tpp) | weidu-tp2 provider |

Each grammar package contains:
- `grammar.js` -- PEG-like grammar definition
- `src/` -- generated C parser (by `tree-sitter generate`)
- `*.wasm` -- compiled WASM (by `tree-sitter build --wasm`)
- `test/` -- corpus tests, sample files, expected output

Type generation: `@asgerf/dts-tree-sitter` generates `SyntaxType` enum from grammar
rules. The enum is copied to `server/src/{lang}/tree-sitter.d.ts` for type-safe
AST node comparisons.

### TextMate Grammars

TextMate grammars (in `syntaxes/`) provide syntax highlighting. Source is YAML,
converted to JSON at build time. Includes:
- 8 primary language grammars
- 4 tooltip grammars (hover rendering)
- 3 injection grammars (comments, strings, docstrings)

## Data Pipeline

Game engine definitions flow from YAML sources to runtime:

```
External Sources (IESDP, sfall, game files)
  |
  v
scripts/utils/src/generate-data.ts     Build-time extraction
  |
  v
server/data/*.yml                       Version-controlled YAML
  |
  v
scripts/utils/src/yaml2json.ts          Build-time conversion
  |
  v
server/out/*.json                       Bundled JSON (completion, hover, signature)
  |
  v
core/static-loader.ts                   Runtime loading into Symbols index
```

YAML data files (~1.7 MB total):

| File | Contents |
|------|----------|
| `fallout-ssl-base.yml` | Fallout SSL functions, variables, constants |
| `fallout-ssl-sfall.yml` | Sfall extension library |
| `weidu-baf-base.yml` | BAF triggers and actions |
| `weidu-baf-ids.yml` | IDS file entries (auto-generated) |
| `weidu-baf-iesdp.yml` | IESDP triggers and actions |
| `weidu-d-base.yml` | D file functions |
| `weidu-tp2-base.yml` | TP2 functions and macros |
| `weidu-tp2-ielib.yml` | IE library functions |
| `weidu-tp2-iesdp.yml` | IESDP WeiDU functions |
| `fallout-worldmap-txt.yml` | Worldmap key-value pairs |

## Test Architecture

See [scripts/README.md](../scripts/README.md) for all test commands.

Four test layers:

- **Server unit tests** (`server/test/`, vitest) -- ~1800 tests covering providers, transpilers, core symbol system, shared utilities
- **Integration tests** -- grammar corpus, TD/TBAF sample transpilation, format comparison, CLI exit codes
- **E2E tests** (`client/src/test/`, mocha + vscode) -- completion, hover in a real VSCode instance
- **Grammar tests** (`grammars/*/test/corpus/`) -- tree-sitter corpus tests per grammar

## Extension Packaging

`.vscodeignore` controls what ships in the VSIX:

```
Included:
  client/out/extension.js                 Client bundle
  client/out/*-webview.js                 Webview bundles
  server/out/server.js                    Server bundle
  server/out/*.json                       Completion/hover/signature data
  server/out/*.wasm                       Tree-sitter WASM parsers
  server/node_modules/sslc-emscripten-*/  Embedded SSL compiler
  language-configurations/*.json          Language settings
  snippets/*.json                         Code snippets
  syntaxes/*.json                         TextMate grammars
  themes/                                 Color and icon themes
  resources/bgforge.png                   Extension icon

Everything else excluded (source, tests, scripts, node_modules, grammars/).
```

## Key Design Decisions

### LSP + Provider Registry

All language features route through a single LSP server with a provider registry.
Providers implement an optional interface -- each language only implements what it
supports. This avoids separate servers per language while keeping providers decoupled.

### Tree-Sitter for Parsing, ts-morph for Transpiling

Tree-sitter (WASM) handles the niche scripting languages -- it's fast, incremental,
and grammar-driven. ts-morph handles transpiler input (TypeScript subset) -- it provides
a full TypeScript AST with type information.

### Pre-Computed Responses

LSP responses (completion items, hover markdown, signature help) are computed once at
parse/index time and stored in `IndexedSymbol`. Requests are O(1) lookups. This trades
memory for latency.

### Sequential Provider Initialization

web-tree-sitter uses a shared `TRANSFER_BUFFER` for JS/WASM communication. Concurrent
`Language.load()` calls corrupt parser state. Providers initialize sequentially.

### Standalone CLIs Reuse Server Code

Format and transpile CLIs import server modules directly. No code duplication. CLIs
are esbuild-bundled to single files with no VSCode dependency.

### TypeScript Plugins for Transpiler Languages

`.tssl` and `.td` files are valid TypeScript subsets. TS plugins intercept tsserver to
suppress false errors and inject engine documentation, giving users full TypeScript
tooling (type checking, refactoring, go-to-definition) alongside transpiler features.
