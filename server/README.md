# VSCode MLS Server Architecture

See also: [development.md](../development.md) | [docs/architecture.md](../docs/architecture.md) | [scripts/README.md](../scripts/README.md)

LSP server providing IDE features for niche scripting languages used in classic RPG modding.

## Overview

```
+------------------+      IPC       +------------------+
|  VSCode Client   | <------------> |   LSP Server     |
|  (extension.ts)  |                |   (server.ts)    |
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
|   +-- symbol-builder.ts     # Raw data -> IndexedSymbol
|   +-- static-loader.ts      # Loads built-in symbols from JSON
|   +-- document-symbols.ts   # DocumentSymbol[] conversion
|   +-- languages.ts          # Language IDs & file extensions
|   +-- patterns.ts           # Regex patterns
|   +-- location-utils.ts     # Position/range helpers
|
+-- fallout-ssl/              # Fallout 1/2 scripting
|   +-- provider.ts
|   +-- parser.ts             # Tree-sitter wrapper
|   +-- format.ts
|   +-- header-parser.ts      # .h file parsing
|   +-- symbols.ts            # DocumentSymbol extraction
|   +-- completion.ts
|   +-- hover.ts
|   +-- definition.ts
|   +-- rename.ts
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
|   +-- parser-factory.ts     # Cached tree-sitter parsers
|   +-- completion.ts         # Shared completion utilities
|   +-- hover.ts              # Shared hover utilities
|   +-- signature.ts          # Signature help utilities
|   +-- jsdoc.ts              # JSDoc parsing
|   +-- pool.ts               # Worker pool for headers
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

| Provider | Completion | Hover | Signature | Definition | Format | Symbols | Rename | Inlay |
|----------|:----------:|:-----:|:---------:|:----------:|:------:|:-------:|:------:|:-----:|
| fallout-ssl | Y | Y | Y | Y | Y | Y | Y | .msg |
| weidu-baf | Y | Y | | | Y | | | .tra |
| weidu-d | Y | Y | | Y | Y | Y | | .tra |
| weidu-tp2 | Y | Y | | Y | Y | Y | Y | .tra |
| worldmap | Y | Y | | | | | | |

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

### 5. Sequential Parser Init
Tree-sitter WASM constraint requires sequential initialization.
Documented in provider-registry.ts.

## Static Data Pipeline

```
+------------------+     +------------------+     +------------------+
| YAML data files  | --> | generate_data.py | --> | completion.      |
| (game functions) |     |                  |     | {lang}.json      |
+------------------+     +------------------+     +------------------+
                                                         |
                                                         v
                                                  +------------------+
                                                  | staticLoader     |
                                                  | .loadStatic()    |
                                                  +------------------+
                                                         |
                                                         v
                                                  +------------------+
                                                  | Symbols      |
                                                  | .loadStatic()    |
                                                  +------------------+
```

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
