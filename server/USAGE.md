# Editor Configuration

How to use `@bgforge/mls-server` with various editors.

## Neovim

Using built-in LSP (`vim.lsp.config`, Neovim 0.11+):

```lua
vim.lsp.config["bgforge-mls"] = {
  cmd = { "bgforge-mls-server", "--stdio" },
  filetypes = { "ssl", "baf", "weidu-d", "weidu-tp2" },
  root_markers = { ".git" },
}

-- Associate file extensions with filetypes
vim.filetype.add({
  extension = {
    ssl = "ssl",
    h = "ssl",  -- or keep as "c" if you prefer; set per-project
    baf = "baf",
    d = "weidu-d",
    tp2 = "weidu-tp2",
    tpa = "weidu-tp2",
    tph = "weidu-tp2",
    tpp = "weidu-tp2",
  },
  filename = {
    ["worldmap.txt"] = "fallout-worldmap-txt",
  },
})
```

Or with [nvim-lspconfig](https://github.com/neovim/nvim-lspconfig) (custom server):

```lua
local lspconfig = require("lspconfig")
local configs = require("lspconfig.configs")

configs.bgforge_mls = {
  default_config = {
    cmd = { "bgforge-mls-server", "--stdio" },
    filetypes = { "ssl", "baf", "weidu-d", "weidu-tp2" },
    root_dir = lspconfig.util.find_git_ancestor,
  },
}

lspconfig.bgforge_mls.setup({})
```

## Helix

Add to `~/.config/helix/languages.toml`:

```toml
[language-server.bgforge-mls]
command = "bgforge-mls-server"
args = ["--stdio"]

[[language]]
name = "ssl"
scope = "source.ssl"
file-types = ["ssl", "h"]
language-servers = ["bgforge-mls"]

[[language]]
name = "weidu-tp2"
scope = "source.weidu-tp2"
file-types = ["tp2", "tpa", "tph", "tpp"]
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
```

## Emacs (eglot)

```elisp
(add-to-list 'eglot-server-programs
             '((ssl-mode baf-mode weidu-tp2-mode weidu-d-mode)
               "bgforge-mls-server" "--stdio"))
```

## Sublime Text

Install the [LSP](https://packagecontrol.io/packages/LSP) package, then add to LSP settings:

```json
{
  "clients": {
    "bgforge-mls": {
      "enabled": true,
      "command": ["bgforge-mls-server", "--stdio"],
      "selector": "source.ssl | source.baf | source.weidu-tp2 | source.weidu-d"
    }
  }
}
```

## TypeScript Plugins (TSSL/TD)

The server package includes TypeScript Language Service Plugins for `.tssl` and `.td` transpiler files. These run inside tsserver (not the LSP server) and provide diagnostic filtering, runtime type injection, and completion filtering.

To use them, add the plugin paths to your project's `tsconfig.json`. The plugins are bundled inside the server package at `out/tssl-plugin.js` and `out/td-plugin.js`. Find the install location with:

```bash
MLS_DIR="$(npm root -g)/@bgforge/mls-server"
# or if installed locally: MLS_DIR="$(npm root)/@bgforge/mls-server"
```

Then in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [
      { "name": "${MLS_DIR}/out/tssl-plugin" },
      { "name": "${MLS_DIR}/out/td-plugin" }
    ]
  }
}
```

Replace `${MLS_DIR}` with the actual path from the shell command above.

**What they do:**
- `tssl-plugin`: Suppresses false TS6133 ("declared but never read") warnings for Fallout engine procedure names, adds engine procedure hover docs.
- `td-plugin`: Injects TD runtime types (`begin`, `say`, `reply`, etc.) so `.td` files get type checking without manual declarations. Filters completions (hides ES2020 lib names in `.td`, hides TD names in non-`.td`).

## Settings

The server accepts configuration via LSP `workspace/didChangeConfiguration`. Settings are under the `bgforge` namespace:

| Setting | Default | Description |
|---------|---------|-------------|
| `bgforge.falloutSSL.compilePath` | `wine ~/bin/compile` | Path to sslc compiler |
| `bgforge.falloutSSL.useBuiltInCompiler` | `false` | Use built-in WASM compiler |
| `bgforge.falloutSSL.compileOptions` | `-q -p -l -O2 -d -s -n` | Compiler flags |
| `bgforge.falloutSSL.outputDirectory` | `""` | Output directory for compiled scripts |
| `bgforge.falloutSSL.headersDirectory` | `""` | Additional headers directory |
| `bgforge.weidu.path` | `weidu` | Path to WeiDU binary |
| `bgforge.weidu.gamePath` | `""` | Path to IE game directory |
| `bgforge.validateOnSave` | `true` | Run diagnostics on save |
| `bgforge.validateOnChange` | `false` | Run diagnostics on edit |
