# Development Guide

## Quick Start

```bash
pnpm install
pnpm build            # Build client, server, test bundles, webviews (includes TS plugins + CLIs)
pnpm test             # Typecheck + lint + unit tests + coverage + transpiler samples + CLI tests + knip
pnpm watch:client     # Dev mode: rebuild on change
pnpm watch:server
```

## Documentation

| Document                                       | Contents                                                                                      |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [docs/architecture.md](docs/architecture.md)   | System overview, build pipeline, client/server/CLI structure, data pipeline, design decisions |
| [server/ARCHITECTURE.md](server/ARCHITECTURE.md) | Server internals: provider registry, symbol system, data flow, tree-sitter integration        |
| [scripts/README.md](scripts/README.md)         | Build and test scripts reference                                                              |
| [grammars/README.md](grammars/README.md)       | Tree-sitter grammars: building, WASM, CJS patching                                            |
| [server/data/README.md](server/data/README.md) | YAML data format for completion/hover                                                         |
| [plugins/tssl-plugin/README.md](plugins/tssl-plugin/README.md) | TSSL tsserver plugin: TS6133 suppression, engine proc hover                  |
| [plugins/td-plugin/README.md](plugins/td-plugin/README.md) | TD tsserver plugin: runtime injection, completion filtering                        |
| [docs/ignore-files.md](docs/ignore-files.md)   | Ignore file reference (.gitignore, .vscodeignore, .prettierignore, eslint)                    |

## Project Structure

```
client/          VSCode extension (LSP client, webviews)
server/          LSP server (providers, transpilers, symbol system)
plugins/         TypeScript Language Service Plugins (tsserver, not LSP)
cli/             Standalone CLIs (format, transpile, binary parser)
grammars/        Tree-sitter grammars (SSL, BAF, D, TP2)
syntaxes/        TextMate grammars (syntax highlighting)
scripts/         Build, test, data generation scripts
server/data/     YAML game engine definitions
```

## Debugging

Press F5 in VSCode to launch the Extension Development Host. Server attaches on port 6009.

Server logs: Output panel, "BGforge MLS" channel.

TS plugin logs: set `"typescript.tsserver.log": "verbose"` in settings, check Output panel under "TypeScript".
