# Kate

Setup guide for using BGforge MLS with Kate (KDE text editor).

- [Prerequisites](#prerequisites)
- [Syntax Highlighting](#syntax-highlighting)
- [Language Server](#language-server)
- [TypeScript Plugins (TSSL/TD)](#typescript-plugins-tssltd)
- [Settings](#settings)

## Prerequisites

```bash
npm install -g @bgforge/mls-server
```

Requires Kate 25.08+ for settings support. Older versions (21.12+) provide basic LSP features but cannot pass settings to the server.

## Syntax Highlighting

Download `bgforge-mls-kate-ksh-<version>.zip` from the [latest GitHub release](https://github.com/BGforgeNet/VScode-BGforge-MLS/releases) and extract the `.xml` files to:

- **Linux**: `~/.local/share/org.kde.syntax-highlighting/syntax/`
- **Windows**: `%USERPROFILE%\AppData\Local\org.kde.syntax-highlighting\syntax\`
- **macOS**: `~/Library/Application Support/org.kde.syntax-highlighting/syntax/`

Restart Kate after installing. The definitions provide keyword, function, and constant highlighting plus code folding. The zip includes definitions for all supported languages, including Fallout MSG (`.msg`), WeiDU TRA (`.tra`), Infinity 2DA (`.2da`), Fallout scripts.lst (`scripts.lst`), and Fallout worldmap.txt (`worldmap.txt`).

Note: `.h` files default to C/C++ in Kate. Use `Tools > Highlighting > Fallout SSL` manually for Fallout header files.

## Language Server

Enable the LSP Client plugin in `Settings > Configure Kate > Plugins > LSP Client`.

Add a server in `Settings > Configure Kate > LSP Client > User Server Settings`:

```json
{
  "servers": {
    "ssl": {
      "command": ["bgforge-mls-server", "--stdio"],
      "highlightingModeRegex": "^(Fallout SSL|WeiDU BAF|WeiDU D|WeiDU TP2|Fallout-Worldmap)$"
    }
  }
}
```

The `highlightingModeRegex` must match the language names from the installed KSyntaxHighlighting definitions. The `Fallout Worldmap` KSH definition matches `worldmap.txt` by filename. For `scripts.lst`, use `Tools > Highlighting > Fallout scripts.lst` manually since the extension is generic.

## TypeScript Plugins (TSSL/TD)

If you write `.tssl` or `.td` transpiler files, the server package includes TypeScript plugins that run inside tsserver. See [TypeScript Plugins](typescript-plugins.md) for setup.

## Settings

Kate sends settings via `workspace/configuration` (requires Kate 25.08+). Add to the server configuration:

```json
{
  "servers": {
    "ssl": {
      "command": ["bgforge-mls-server", "--stdio"],
      "highlightingModeRegex": "^(Fallout SSL|WeiDU BAF|WeiDU D|WeiDU TP2|Fallout-Worldmap)$",
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
