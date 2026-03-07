# Server Architecture

See also: [development.md](../development.md) | [docs/architecture.md](../docs/architecture.md) | [scripts/README.md](../scripts/README.md)

LSP server providing IDE features for niche scripting languages used in classic RPG modding.

## Overview

```
+------------------+    IPC/stdio   +------------------+
|   Editor Client  | <------------> |   LSP Server     |
|                  |                |   (server.ts)    |
+------------------+                +------------------+
                                            |
                                            v
                                   +------------------+
                                   | ProviderRegistry |
                                   +------------------+
                                            |
              +-----------------------------+-----------------------------+
              |              |              |              |              |
              v              v              v              v              v
        +---------+    +---------+    +---------+    +---------+    +---------+
        | Fallout |    | WeiDU   |    | WeiDU   |    | WeiDU   |    | Fallout |
        |   SSL   |    |   BAF   |    |    D    |    |   TP2   |    |Worldmap |
        +---------+    +---------+    +---------+    +---------+    +---------+
```

## Core Concepts

### Single Source of Truth: Symbols

Symbols from headers and static data are stored in a unified index:

- **Static Symbols** (global) - Built-in functions from YAML/JSON (e.g., COPY_EXISTING)
- **Workspace Symbols** - From .h/.tph header files, indexed via `reloadFileData()`
- **Local Symbols** - Current file's variables, computed on-demand via `localCompletion()`

**No duplication by design**: When querying completions, `getCompletions(uri)` passes `excludeUri` to skip the current file's indexed symbols. Local symbols are always computed fresh from the editor buffer. This ensures each symbol has exactly one source.

**Null for missing data**: Static symbols have `location: null` and `source.uri: null` (not empty strings). This is enforced at input time by `static-loader.ts`, and TypeScript ensures null checks at all usage sites. Use `lookupDefinition()` for go-to-definition - it returns `null` for static symbols.

### Pre-Computed Responses

LSP responses are computed once at parse time, not on each request:

```
Header File Change
       |
       v
  +---------+       +------------------+
  | Parser  | ----> | IndexedSymbol    |
  +---------+       |------------------|
                    | .name            |
                    | .location        |
                    | .completion  <------- Ready for getCompletions()
                    | .hover       <------- Ready for getHover()
                    | .signature   <------- Ready for getSignature()
                    +------------------+
```

## Directory Structure

```
server/src/
|
+-- server.ts                 # LSP entry point
+-- provider-registry.ts      # Routes requests to providers
+-- language-provider.ts      # Provider interface
|
+-- core/
|   +-- symbol.ts             # IndexedSymbol type definitions
|   +-- symbol-index.ts       # Symbols class - unified storage & query
|   +-- static-loader.ts      # Loads built-in symbols from JSON
|   +-- include-graph.ts      # Generic include graph (dependency-graph wrapper)
|   +-- include-resolver.ts   # Resolves #include paths to file URIs
|   +-- languages.ts          # Language IDs & file extensions
|   +-- patterns.ts           # Regex patterns
|   +-- location-utils.ts     # Position/range helpers
|
+-- fallout-ssl/              # Fallout 1/2 scripting
|   +-- tree-sitter.d.ts      # Generated SyntaxType enum
|   +-- provider.ts
|   +-- parser.ts             # Tree-sitter wrapper
|   +-- format.ts
|   +-- header-parser.ts      # .h file parsing
|   +-- include-scanner.ts    # Extracts #include paths from AST
|   +-- symbols.ts            # DocumentSymbol extraction
|   +-- completion.ts
|   +-- hover.ts
|   +-- definition.ts
|   +-- rename.ts             # Single-file + workspace-wide rename orchestration
|   +-- symbol-scope.ts       # Scope determination (file vs procedure) for rename
|   +-- reference-finder.ts   # Scope-restricted reference finding for rename
|   +-- signature.ts
|
+-- weidu-baf/                # WeiDU BAF scripts
|   +-- tree-sitter.d.ts      # Generated SyntaxType enum
+-- weidu-d/                  # WeiDU dialog files
|   +-- tree-sitter.d.ts      # Generated SyntaxType enum
+-- weidu-tp2/                # WeiDU mod installers
|   +-- tree-sitter.d.ts      # Generated SyntaxType enum
+-- fallout-worldmap/         # Fallout worldmap.txt
|
+-- tssl/                     # TypeScript -> SSL transpiler
+-- tbaf/                     # TypeScript -> BAF transpiler
+-- td/                       # TypeScript -> D transpiler
|
+-- shared/
|   +-- hash.ts               # Shared djb2 hash for cache keys
|   +-- parser-factory.ts     # Cached tree-sitter parsers
|   +-- workspace-symbols.ts  # WorkspaceSymbolIndex for Ctrl+T search
|   +-- completion.ts         # Shared completion utilities
|   +-- hover.ts              # Shared hover utilities
|   +-- signature.ts          # Signature help utilities
|   +-- jsdoc.ts              # JSDoc parsing
|
+-- translation.ts            # .tra/.msg translation service
+-- compile.ts                # Compilation dispatch
+-- settings.ts               # User settings
+-- common.ts                 # Logging, file utils
```

## Data Flow

### Initialization

```
Extension Activated
       |
       v
+----------------+
| server.ts      |
| onInitialized  |
+----------------+
       |
       v
+------------------+     Sequential init     +------------------+
| ProviderRegistry | ------------------->    | Each Provider    |
| init()           |   (WASM constraint)     | init()           |
+------------------+                         +------------------+
       |                                            |
       v                                            v
+------------------+                         +------------------+
| Scan workspace   |                         | Load static      |
| for headers      |                         | symbols (JSON)   |
+------------------+                         +------------------+
       |                                            |
       v                                            v
+------------------+                         +------------------+
| Parse .h/.tph    |                         | Symbols      |
| files            |                         | loadStatic()     |
+------------------+                         +------------------+
       |
       v
+------------------+
| Symbols      |
| updateFile()     |
+------------------+
```

### Hover Request

```
                             onHover(position)
                                    |
                                    v
                          +------------------+
                          | Extract symbol   |
                          | at position      |
                          +------------------+
                                    |
                                    v
    +---------------------------------------------------------------+
    |                      Try in order:                             |
    +---------------------------------------------------------------+
    |                                                                |
    |   1. Local Hover (AST-based)                                   |
    |   +------------------+                                         |
    |   | provider.hover() |  Parse current file, find definition   |
    |   +------------------+                                         |
    |           |                                                    |
    |           | undefined = not found locally                      |
    |           v                                                    |
    |   2. Data Hover (pre-computed)                                 |
    |   +------------------+                                         |
    |   | Symbols      |  Look up from headers/static           |
    |   | .lookup(symbol)  |                                         |
    |   | .hover           |                                         |
    |   +------------------+                                         |
    |           |                                                    |
    |           | null = not found                                   |
    |           v                                                    |
    |   3. Translation Hover                                         |
    |   +------------------+                                         |
    |   | translation      |  For @123 style references             |
    |   | .getHover()      |                                         |
    |   +------------------+                                         |
    |                                                                |
    +---------------------------------------------------------------+
                                    |
                                    v
                          +------------------+
                          | Return first     |
                          | non-null result  |
                          +------------------+
```

### File Change

```
Document Changed (debounced 300ms)
              |
              v
    +------------------+
    | Is watched file? |
    | (.h, .tph, etc.) |
    +------------------+
         /          \
       Yes           No
        |             |
        v             v
+----------------+  +----------------+
| provider       |  | Local symbols  |
| .reloadFile()  |  | only (no index |
+----------------+  | update)        |
        |           +----------------+
        v
+----------------+
| Symbols    |
| .updateFile()  |
| (replaces old) |
+----------------+
```

## Symbol Type System

### Discriminated Union

`IndexedSymbol` is a union type where `.kind` determines available fields:

| Type | Extra Field | Description |
|------|-------------|-------------|
| `CallableSymbol` | `.callable` | Functions, procedures, macros |
| `VariableSymbol` | `.variable` | Variables, parameters |
| `ConstantSymbol` | `.constant` | Constant values |
| `StateSymbol` | - | Dialog states (D files) |
| `ComponentSymbol` | - | TP2 mod components |

### Symbol Kinds

| Category | Kind | Example |
|----------|------|---------|
| Callables | `Function` | DEFINE_ACTION_FUNCTION |
| | `Procedure` | SSL procedure |
| | `Macro` | #define, DEFINE_*_MACRO |
| | `Action` | WeiDU action (BAF/D/TP2) |
| | `Trigger` | WeiDU trigger (BAF/D) |
| Data | `Variable` | OUTER_SET, SET |
| | `Constant` | #define constant |
| | `Parameter` | INT_VAR, STR_VAR |
| | `LoopVariable` | PHP_EACH iteration var |
| Structures | `State` | Dialog state (D files) |
| | `Component` | TP2 mod component |

### Scope Hierarchy

| Scope | Visibility |
|-------|------------|
| Global | Built-in functions, always visible |
| Workspace | From headers (.h, .tph), visible everywhere |
| File | Current file only (script-scope variables) |
| Function | Inside procedure/function body only |
| Loop | Loop iteration variable (e.g., PHP_EACH) |

Lookup precedence (highest to lowest): Loop > Function > File > Workspace > Global

## Provider Interface

```typescript
interface LanguageProvider {
  id: string

  // Lifecycle
  init(context: ProviderContext): Promise<void>

  // AST-based features (parse current document)
  format?(text, uri): FormatResult
  symbols?(text): DocumentSymbol[]
  definition?(text, position, uri): Location | null
  hover?(text, symbol, uri, position): Hover | null | undefined
  localCompletion?(text): CompletionItem[]
  localSignature?(text, symbol, paramIndex): SignatureHelp | null
  rename?(text, position, newName, uri): WorkspaceEdit | null

  // Data features (from Symbols)
  getCompletions?(uri): CompletionItem[]
  getHover?(uri, symbol): Hover | null
  getSignature?(uri, symbol, paramIndex): SignatureHelp | null
  getSymbolDefinition?(symbol): Location | null

  // File watching
  watchExtensions?: string[]
  reloadFileData?(uri, text): void
  onWatchedFileDeleted?(uri): void
}
```

## Tree-Sitter Integration

### Parser Initialization

```
+------------------+     +------------------+     +------------------+
| Provider init()  | --> | createCached     | --> | tree-sitter-     |
|                  |     | ParserModule()   |     | {lang}.wasm      |
+------------------+     +------------------+     +------------------+
                                |
                                v
                         +------------------+
                         | Parser instance  |
                         | (module-level)   |
                         +------------------+
```

**Important**: Parsers must initialize sequentially due to shared WASM `TRANSFER_BUFFER`.

### SyntaxType Enum

Each grammar generates a `tree-sitter.d.ts` file with a `SyntaxType` enum for type-safe node type comparisons:

```typescript
// Generated from grammar - use instead of hardcoded strings
import { SyntaxType } from "./tree-sitter.d";

if (node.type === SyntaxType.State) { ... }  // Good
if (node.type === "state") { ... }           // Bad - no type checking
```

Generate types for a grammar:
```bash
cd grammars/{lang} && pnpm generate:types
```

This copies the generated `tree-sitter.d.ts` to `server/src/{lang}/`.

### Parse Caching

`parseWithCache(text)` hashes the input and checks a 10-entry LRU cache before parsing. This avoids re-parsing on repeated requests (e.g., multiple hovers on same file).

## Feature Matrix

| Provider | Completion | Hover | Signature | Definition | Format | Symbols | Workspace Symbols | Rename | Inlay | Folding |
|----------|:----------:|:-----:|:---------:|:----------:|:------:|:-------:|:-----------------:|:------:|:-----:|:-------:|
| fallout-ssl | Y | Y | Y | Y | Y | Y | Y | Y | .msg | Y |
| weidu-baf | Y | Y | | | Y | | | | .tra | Y |
| weidu-d | Y | Y | | Y | Y | Y | | | .tra | Y |
| weidu-tp2 | Y | Y | | Y | Y | Y | Y | Y | .tra | Y |
| worldmap | Y | Y | | | | | | | | |

## Request Routing

1. `server.ts` receives LSP request (e.g., `connection.onHover`)
2. `ProviderRegistry` looks up provider by `langId` (or alias)
3. Provider method called (local AST-based or data-based)
4. Result returned to client

### Language Aliases

| Alias | Routes to |
|-------|-----------|
| weidu-slb | weidu-baf |
| weidu-ssl | weidu-baf |

## Translation Service

Separate from Symbols, handles .tra/.msg translation files:

- `getHover(@123)` - Returns translation text for string references
- `getInlayHints()` - Shows translation text inline at call sites
- `reloadFile()` - Updates cache when translation files change

## Include Graph

The include graph tracks `#include` relationships between files for workspace-wide rename.

```
+------------------+     +------------------+     +------------------+
| include-scanner  | --> | include-resolver | --> | IncludeGraph     |
| (AST extraction) |     | (path resolve)   |     | (dependency-graph)|
+------------------+     +------------------+     +------------------+
```

### Components

| Module | Layer | Purpose |
|--------|-------|---------|
| `core/include-graph.ts` | Generic | Wraps `dependency-graph` for transitive dependant queries |
| `core/include-resolver.ts` | Generic | Resolves raw paths to file URIs (with path traversal protection) |
| `fallout-ssl/include-scanner.ts` | Language-specific | Extracts `#include` paths from SSL tree-sitter AST |

### Rename (Scope-Aware)

Rename uses a three-module pipeline: `symbol-scope.ts` → `reference-finder.ts` → `rename.ts`.

**Scope determination** (`symbol-scope.ts`): Given a cursor position, determines whether
the symbol is file-scoped (procedure name, macro, export) or procedure-scoped (param,
variable, for/foreach var). Returns `SslSymbolScope` with the scope type and, for
procedure-scoped symbols, the containing procedure node.

**Reference finding** (`reference-finder.ts`): Collects all identifier references within
the correct scope. For procedure-scoped symbols, walks only the procedure subtree. For
file-scoped symbols, walks the entire tree but skips into procedures that shadow the name
with a local definition.

**Single-file rename** (`rename.ts`): Uses scope info to rename only within the correct scope.

**Workspace-wide rename** (`rename.ts`): For symbols defined in header files:

1. Find the definition URI (local AST or symbol store lookup)
2. Query `includeGraph.getTransitiveDependants(defUri)` for all consuming files
3. For each candidate file, use scope-aware reference finding (skips procedure-local shadows)
4. Skip files that redefine the symbol at file scope (a different procedure/macro with same name)
5. Return `documentChanges` (TextDocumentEdit[]) for atomic cross-file undo

The include graph is built at init time (async I/O) and updated incrementally on file save/change.

## Key Design Decisions

### 1. Pre-Computation
All LSP responses computed at parse time, stored in IndexedSymbol.
Trade-off: More memory, but instant responses.

### 2. Scope-Aware Lookup
Symbols respects visibility rules automatically.
Prevents returning symbols from wrong scope.

### 3. File-Level Granularity
Updates only affect changed file, not entire index.
Efficient for large workspaces.

### 4. Fallthrough Pattern

Features try sources in order: local (AST) -> data (index) -> translation. Return `undefined` to continue to next source, `null` to stop.

### 5. Intentional Per-Language Implementations

Several features have separate implementations per provider that may look like duplication
but are intentionally language-specific. Shared infrastructure is in `shared/`:

| Feature | Why per-language |
|---------|-----------------|
| Definition finders | Different scoping models (SSL procedures vs TP2 functions vs D state labels) |
| Document symbol extraction | Different construct types per language |
| Rename | SSL is workspace-wide with include graph; TP2 is single-file with %var% handling |
| Reference finders | SSL has procedure scope shadows; TP2 has synthetic string nodes |
| Folding block type sets | Language-specific node types, passed as parameters to shared `getFoldingRanges()` |
| Comment stripping | `stripCommentsWeidu()` handles `~string~` delimiters; `stripCommentsFalloutSsl()` does not |

### 6. Sequential Parser Init
Tree-sitter WASM constraint requires sequential initialization.
Documented in provider-registry.ts.

## Static Data Pipeline

```
+------------------+     +------------------+     +------------------+
| YAML data files  | --> | generate-data.ts | --> | completion.      |
| (game functions) |     | (shared building |     | {lang}.json      |
|                  |     |  blocks)         |     | (pre-formatted)  |
+------------------+     +------------------+     +------------------+
                                                         |
                                                         v
                                                  +------------------+
                                                  | loadStaticSymbols|
                                                  +------------------+
                                                         |
                                                         v
                                                  +------------------+
                                                  | Symbols          |
                                                  | .loadStatic()    |
                                                  +------------------+
```

All formatting is pre-computed at build time by `generate-data.ts`. WeiDU/TP2 items use `buildWeiduHoverContent()` — the same composition function used by runtime JSDoc hover formatters — ensuring identical output. Fallout items use the lower-level building blocks (`buildSignatureBlock`, `buildFalloutArgsTable`, `formatDeprecation`) directly. The static loader is a pure pass-through — no runtime transforms. See `server/data/README.md` for the YAML schema and formatting pipeline.

## Testing

See [scripts/README.md](../scripts/README.md) for all test commands.

## Adding a New Provider

1. Create `src/{lang}/provider.ts` implementing `LanguageProvider`
2. Create tree-sitter grammar in `grammars/{lang}/`
3. Add `@asgerf/dts-tree-sitter` devDependency and `generate:types` script to grammar's `package.json`
4. Run `pnpm generate:types` to create `tree-sitter.d.ts` with `SyntaxType` enum
5. Register in `provider-registry.ts`
6. Add language ID to `core/languages.ts`
7. Add static data to `data/{lang}.yml` (if needed)
8. Run `pnpm build:grammar` to compile WASM

## Performance Considerations

- **Parse caching**: 10-entry LRU cache avoids re-parsing
- **Debounced reload**: 300ms delay on document changes
- **Pre-computed responses**: No computation on LSP requests
- **File-level updates**: Only changed file re-indexed
- **Sequential init**: Required by tree-sitter, adds ~100ms startup
