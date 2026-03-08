# Settings

([How to change settings in VScode](https://code.visualstudio.com/docs/getstarted/settings))

All settings are under the `bgforge` namespace.

## General

| Setting                    | Default | Description                                                                     |
| -------------------------- | ------- | ------------------------------------------------------------------------------- |
| `bgforge.validateOnSave`   | `true`  | Run diagnostics on save                                                         |
| `bgforge.validateOnChange` | `false` | Run diagnostics on edit (disk-intensive: writes to disk for external compilers) |
| `bgforge.debug`            | `false` | Enable debug logging in the Output panel (BGforge MLS channel)                  |

## Fallout SSL

| Setting                                 | Default                 | Description                                                     |
| --------------------------------------- | ----------------------- | --------------------------------------------------------------- |
| `bgforge.falloutSSL.compilePath`        | `compile`               | Path to sslc compiler (or add to system PATH)                   |
| `bgforge.falloutSSL.useBuiltInCompiler` | `false`                 | Use built-in WASM compiler instead of external sslc             |
| `bgforge.falloutSSL.compileOptions`     | `-q -p -l -O2 -d -s -n` | Compiler flags                                                  |
| `bgforge.falloutSSL.outputDirectory`    | `""`                    | Output directory for compiled scripts (default: next to source) |
| `bgforge.falloutSSL.headersDirectory`   | `""`                    | Additional headers directory (workspace is always scanned)      |

## WeiDU

| Setting                  | Default | Description                                                       |
| ------------------------ | ------- | ----------------------------------------------------------------- |
| `bgforge.weidu.path`     | `weidu` | Path to WeiDU binary (or add to system PATH)                      |
| `bgforge.weidu.gamePath` | `""`    | Absolute path to IE game directory (needed for BAF/D diagnostics) |

## How to Pass Settings

Depends on the editor. See the editor-specific pages for examples:

- [Sublime Text](editors/sublime-text.md#settings) - `settings` in LSP client config
- [Neovim](editors/neovim.md#settings) - `settings` table in `vim.lsp.config`
- [Emacs](editors/emacs.md#settings) - `eglot-workspace-configuration` or lsp-mode
- [JetBrains](editors/jetbrains.md#settings) - LSP4IJ Configuration tab
- [Helix](editors/helix.md#settings) - `config` table in `languages.toml`
- [Zed](editors/zed.md#settings) - `settings` in `lsp` config
- [Geany](editors/geany.md#settings) - `initialization_options` in LSP Client config
- [Kate](editors/kate.md#settings) - `settings` in LSP client config (Kate 25.08+)
- [Notepad++](editors/notepadpp.md#settings) - `settings` in NppLspClient config
