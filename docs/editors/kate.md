# Kate

Setup guide for using BGforge MLS with Kate (KDE text editor).

## Prerequisites

```bash
npm install -g @bgforge/mls-server
```

Requires Kate 25.08+ for settings support. Older versions (21.12+) provide basic LSP features but cannot pass settings to the server.

## File Type Detection

Go to `Settings > Configure Kate > Open/Save > Modes & Filetypes` and add entries:

| Name | File extensions |
|------|-----------------|
| SSL | `*.ssl` |
| BAF | `*.baf` |
| WeiDU-D | `*.d` |
| WeiDU-TP2 | `*.tp2;*.tpa;*.tph;*.tpp` |
| Fallout-Worldmap | `worldmap.txt` |

Note: `.h` files default to C/C++ in Kate. Use `Tools > Highlighting > SSL` manually for Fallout header files.

## Language Server

Enable the LSP Client plugin in `Settings > Configure Kate > Plugins > LSP Client`.

Add a server in `Settings > Configure Kate > LSP Client > User Server Settings`:

```json
{
  "servers": {
    "ssl": {
      "command": ["bgforge-mls-server", "--stdio"],
      "highlightingModeRegex": "^(SSL|BAF|WeiDU-D|WeiDU-TP2|Fallout-Worldmap)$"
    }
  }
}
```

The `highlightingModeRegex` must match the mode names from the File Type Detection section above.

## TypeScript Plugins (TSSL/TD)

If you write `.tssl` or `.td` transpiler files, the server package includes TypeScript plugins that run inside tsserver. See [TypeScript Plugins](typescript-plugins.md) for setup.

## Settings

Kate sends settings via `workspace/configuration` (requires Kate 25.08+). Add to the server configuration:

```json
{
  "servers": {
    "ssl": {
      "command": ["bgforge-mls-server", "--stdio"],
      "highlightingModeRegex": "^(SSL|BAF|WeiDU-D|WeiDU-TP2|Fallout-Worldmap)$",
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

On older Kate versions, the server falls back to built-in defaults.

See [Settings Reference](../settings.md) for all available options.
