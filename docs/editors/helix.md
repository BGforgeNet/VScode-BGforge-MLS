# Helix

Setup guide for using BGforge MLS with Helix.

## Prerequisites

```bash
npm install -g @bgforge/mls-server
```

## Language Server and File Types

Add to `~/.config/helix/languages.toml`:

```toml
[language-server.bgforge-mls]
command = "bgforge-mls-server"
args = ["--stdio"]

[[language]]
name = "fallout-ssl"
scope = "source.fallout-ssl"
file-types = ["ssl", "h"]
language-servers = ["bgforge-mls"]

[[language]]
name = "weidu-baf"
scope = "source.weidu-baf"
file-types = ["baf"]
language-servers = ["bgforge-mls"]

[[language]]
name = "weidu-d"
scope = "source.weidu-d"
file-types = [{ glob = "*.d" }]
language-servers = ["bgforge-mls"]

[[language]]
name = "weidu-tp2"
scope = "source.weidu-tp2"
file-types = ["tp2", "tpa", "tph", "tpp"]
language-servers = ["bgforge-mls"]

[[language]]
name = "fallout-worldmap-txt"
scope = "source.fallout-worldmap-txt"
file-types = [{ glob = "worldmap.txt" }]
language-servers = ["bgforge-mls"]
```

Note: `.h` files default to C/C++ in Helix. The override above sets them to Fallout SSL globally. Remove `"h"` from the list if you need C headers in the same project.

## TypeScript Plugins (TSSL/TD)

If you write `.tssl` or `.td` transpiler files, the server package includes TypeScript plugins that run inside tsserver. See [TypeScript Plugins](typescript-plugins.md) for setup.

## Settings

Helix passes LSP settings via the `config` table in `languages.toml`:

```toml
[language-server.bgforge-mls]
command = "bgforge-mls-server"
args = ["--stdio"]

[language-server.bgforge-mls.config.bgforge]
validateOnSave = true
validateOnChange = false

[language-server.bgforge-mls.config.bgforge.falloutSSL]
compilePath = "compile"
useBuiltInCompiler = false
compileOptions = "-q -p -l -O2 -d -s -n"
outputDirectory = ""
headersDirectory = ""

[language-server.bgforge-mls.config.bgforge.weidu]
path = "weidu"
gamePath = ""
```

See [Settings Reference](../settings.md) for all available options.
