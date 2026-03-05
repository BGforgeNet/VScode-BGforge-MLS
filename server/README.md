# @bgforge/mls-server

Standalone LSP server for WeiDU languages, Fallout 2 SSL, and transpiled TSSL, TBAF, TD.

## Supported Languages

| Language         | Extensions                     | Features                                                                                 |
| ---------------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| Fallout SSL      | `.ssl`, `.h`                   | Completion, hover, signature, go-to-definition, formatting, symbols, rename, inlay hints |
| WeiDU TP2        | `.tp2`, `.tpa`, `.tph`, `.tpp` | Completion, hover, go-to-definition, formatting, symbols, rename, inlay hints            |
| WeiDU BAF        | `.baf`                         | Completion, hover, formatting, inlay hints                                               |
| WeiDU D          | `.d`                           | Completion, hover, go-to-definition, formatting, symbols, inlay hints                    |
| Fallout worldmap | `worldmap.txt`                 | Completion, hover                                                                        |

Aliases: SCS SSL (`.ssl`) and SLB (`.slb`) are treated as WeiDU BAF.

Transpiler support (TypeScript to target language): TSSL, TBAF, TD.

## Installation

```bash
npm install -g @bgforge/mls-server
```

## Usage

The server communicates over stdio:

```bash
bgforge-mls-server --stdio
```

[Settings Reference](../docs/settings.md) - All server settings with defaults.

See [USAGE.md](USAGE.md) for editor setup guides and settings reference.

## Links

- [VSCode extension](https://marketplace.visualstudio.com/items?itemName=BGforge.bgforge-mls) (full-featured client)
- [Source code](https://github.com/BGforgeNet/VScode-BGforge-MLS)
- [Issue tracker](https://github.com/BGforgeNet/VScode-BGforge-MLS/issues)
- [Architecture](ARCHITECTURE.md) (server internals for contributors)
