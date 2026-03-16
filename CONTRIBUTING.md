# Contributing

## Quick Start

```bash
pnpm install
pnpm build            # Build client, server, test bundles, webviews (includes TS plugins + CLIs)
pnpm test             # Typecheck + lint + unit tests + coverage + transpiler samples + CLI tests + knip
pnpm watch:client     # Dev mode: rebuild on change
pnpm watch:server
```

## Documentation

| Document                                                       | Contents                                                                                      |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [docs/architecture.md](docs/architecture.md)                   | System overview, build pipeline, client/server/CLI structure, data pipeline, design decisions |
| [docs/lsp-api.md](docs/lsp-api.md)                             | Public LSP/client-server contract for third-party clients                                     |
| [server/INTERNALS.md](server/INTERNALS.md)                     | Server internals: provider registry, symbol system, data flow, tree-sitter integration        |
| [scripts/README.md](scripts/README.md)                         | Build and test scripts reference                                                              |
| [grammars/README.md](grammars/README.md)                       | Tree-sitter grammars: building, WASM, CJS patching                                            |
| [server/data/README.md](server/data/README.md)                 | YAML data format for completion/hover                                                         |
| [plugins/tssl-plugin/README.md](plugins/tssl-plugin/README.md) | TSSL tsserver plugin: TS6133 suppression, engine proc hover                                   |
| [plugins/td-plugin/README.md](plugins/td-plugin/README.md)     | TD tsserver plugin: runtime injection, completion filtering                                   |
| [docs/ignore-files.md](docs/ignore-files.md)                   | Ignore file reference (.gitignore, .vscodeignore, editorconfig, oxlint)                       |

## Project Structure

See [docs/architecture.md](docs/architecture.md) for full repository layout.

## API Documentation Rule

If a change affects what a client must send, can receive, or may rely on over LSP or the shared client/server protocol, update [docs/lsp-api.md](docs/lsp-api.md) in the same change.

This includes:

- new custom requests, notifications, commands, or payload fields
- changes to the meaning or encoding of existing request parameters
- behavior differences that third-party clients may need to opt into

Architecture-only docs are not enough for those cases. Document the wire-level contract and compatibility expectations explicitly.

## Debugging

Press F5 in VSCode to launch the Extension Development Host. Server attaches on port 6009.

Server logs: Output panel, "BGforge MLS" channel.

TS plugin logs: set `"typescript.tsserver.log": "verbose"` in settings, check Output panel under "TypeScript".

## Temporary Files

Keep transient test/build artifacts under the repo-level `tmp/` directory unless a tool specifically requires system temp storage.

Do not create temporary directories inside source or fixture trees such as `server/test/`, `cli/test/`, or `scripts/**`.
