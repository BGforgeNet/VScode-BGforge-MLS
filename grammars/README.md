# Tree-sitter Grammars

## fallout-ssl

Tree-sitter grammar for Fallout 1/2 Star-Trek Scripting Language (SSL).

### Building

```bash
pnpm build-grammar
```

Or manually:
```bash
cd grammars/fallout-ssl
tree-sitter generate
tree-sitter build --wasm
```

### Why WASM?

We use `web-tree-sitter` (WASM) instead of native `tree-sitter` bindings because:

1. **Portability** - WASM works on all platforms (Windows, macOS, Linux) without recompilation
2. **No native dependencies** - Users don't need node-gyp, Python, or C++ build tools
3. **Node.js compatibility** - Native tree-sitter lacks prebuilds for newer Node versions (e.g., Node 24)
4. **Simpler distribution** - Just ship the `.wasm` file, no platform-specific binaries

The performance difference is negligible for our use case (parsing single files for dialog extraction).

### Deployment

WASM files are copied automatically by `scripts/build-base-server.sh` during build:
- `web-tree-sitter.wasm` - core parser runtime
- `tree-sitter-ssl.wasm` - SSL grammar

Loaded by `server/src/dialog.ts` and `server/src/format-fallout-ssl.ts` at runtime.

### CJS Bundle Patch (import_meta)

**Problem**: `web-tree-sitter` internally uses `import.meta.url` for WASM file resolution, even when you pass `wasmBinary` directly to `Parser.init()`. When esbuild bundles to CJS format, it creates an empty `var import_meta = {};`, causing "undefined filename" errors.

**Solution**: Patch the bundled output to provide `import_meta.url`:

```bash
sed -i "s/var import_meta = {};/var import_meta = {url: require('url').pathToFileURL(__filename).href};/" output.js
```

This is applied in:
- `scripts/build-base-server.sh` - for the LSP server bundle
- `package.json` `build:format-cli` script - for the CLI tool

Any new bundle using `web-tree-sitter` needs this patch.
