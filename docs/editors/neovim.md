# Neovim

Setup guide for using BGforge MLS with Neovim 0.11+.

## Prerequisites

```bash
npm install -g @bgforge/mls-server
```

## File Type Detection

```lua
vim.filetype.add({
  extension = {
    ssl = "fallout-ssl",
    h = "fallout-ssl",  -- or keep as "c" if you prefer; set per-project
    baf = "weidu-baf",
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

Note: `.h` files default to C in Neovim. The override above sets them to Fallout SSL globally. For per-project control, use a `.nvimrc` or `exrc` instead.

Note: `.d` files may conflict with D language. Adjust per-project if needed.

## Language Server

```lua
vim.lsp.config["bgforge-mls"] = {
  cmd = { "bgforge-mls-server", "--stdio" },
  filetypes = { "fallout-ssl", "weidu-baf", "weidu-d", "weidu-tp2", "fallout-worldmap-txt" },
  root_markers = { ".git" },
}

vim.lsp.enable("bgforge-mls")
```

## TypeScript Plugins (TSSL/TD)

If you write `.tssl` or `.td` transpiler files, the server package includes TypeScript plugins that run inside tsserver. See [TypeScript Plugins](typescript-plugins.md) for setup.

## Settings

Pass settings under the `bgforge` namespace in the `settings` table:

```lua
vim.lsp.config["bgforge-mls"] = {
  cmd = { "bgforge-mls-server", "--stdio" },
  filetypes = { "fallout-ssl", "weidu-baf", "weidu-d", "weidu-tp2", "fallout-worldmap-txt" },
  root_markers = { ".git" },
  settings = {
    bgforge = {
      validateOnSave = true,
      validateOnChange = false,
      falloutSSL = {
        compilePath = "compile",
        useBuiltInCompiler = false,
        compileOptions = "-q -p -l -O2 -d -s -n",
        outputDirectory = "",
        headersDirectory = "",
      },
      weidu = {
        path = "weidu",
        gamePath = "",
      },
    },
  },
}

vim.lsp.enable("bgforge-mls")
```

See [Settings Reference](../settings.md) for all available options.
