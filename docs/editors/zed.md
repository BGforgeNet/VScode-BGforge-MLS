# Zed

Setup guide for using BGforge MLS with Zed.

## Prerequisites

```bash
npm install -g @bgforge/mls-server
```

## Extension

Zed requires a [Zed extension](https://zed.dev/docs/extensions) to register custom language servers. Until a BGforge MLS extension is published, create a local extension.

Create a directory (e.g., `~/zed-extensions/bgforge-mls/`) with the following files:

### `extension.toml`

```toml
id = "bgforge-mls"
name = "BGforge MLS"
version = "0.0.1"
schema_version = 1

[language_servers.bgforge-mls]
name = "BGforge MLS"
languages = ["Fallout SSL", "WeiDU BAF", "WeiDU D", "WeiDU TP2", "Fallout Worldmap"]
```

### `Cargo.toml`

```toml
[package]
name = "bgforge-mls"
version = "0.0.1"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
zed_extension_api = "0.5"
```

### `src/lib.rs`

```rust
use zed_extension_api as zed;

struct BgforgeMlsExtension;

impl zed::Extension for BgforgeMlsExtension {
    fn new() -> Self {
        BgforgeMlsExtension
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &zed::LanguageServerId,
        _worktree: &zed::Worktree,
    ) -> zed::Result<zed::Command> {
        Ok(zed::Command {
            command: "bgforge-mls-server".to_string(),
            args: vec!["--stdio".to_string()],
            env: Default::default(),
        })
    }
}

zed::register_extension!(BgforgeMlsExtension);
```

### Language Definitions

**`languages/fallout-ssl/config.toml`**:

```toml
name = "Fallout SSL"
path_suffixes = ["ssl", "h"]
```

**`languages/weidu-baf/config.toml`**:

```toml
name = "WeiDU BAF"
path_suffixes = ["baf"]
```

**`languages/weidu-d/config.toml`**:

```toml
name = "WeiDU D"
path_suffixes = ["d"]
```

**`languages/weidu-tp2/config.toml`**:

```toml
name = "WeiDU TP2"
path_suffixes = ["tp2", "tpa", "tph", "tpp"]
```

**`languages/fallout-worldmap/config.toml`**:

```toml
name = "Fallout Worldmap"
```

Fallout Worldmap has no `path_suffixes` to avoid matching all `.txt` files. Use Zed's `file_types` setting to associate `worldmap.txt`:

```json
{
  "file_types": {
    "Fallout Worldmap": ["**/worldmap.txt"]
  }
}
```

### Install

Open Zed, go to `Extensions`, click `Install Dev Extension`, and point to the directory.

Note: `.h` files default to C in Zed. For per-project control, add `file_types` overrides in `.zed/settings.json`.

## TypeScript Plugins (TSSL/TD)

If you write `.tssl` or `.td` transpiler files, the server package includes TypeScript plugins that run inside tsserver. See [TypeScript Plugins](typescript-plugins.md) for setup.

## Settings

Zed passes LSP settings via the `lsp` section in user or project settings (`~/.config/zed/settings.json` or `.zed/settings.json`):

```json
{
  "lsp": {
    "bgforge-mls": {
      "settings": {
        "bgforge": {
          "validateOnSave": true,
          "validateOnChange": false,
          "falloutSSL": {
            "compilePath": "compile",
            "useBuiltInCompiler": false,
            "compileOptions": "-q -p -l -O2 -d -s -n",
            "outputDirectory": "",
            "headersDirectory": ""
          },
          "weidu": {
            "path": "weidu",
            "gamePath": ""
          }
        }
      }
    }
  }
}
```

See [Settings Reference](../settings.md) for all available options.
