# Tree-sitter Grammars

See also: [development.md](../development.md) | [docs/architecture.md](../docs/architecture.md) | [scripts/README.md](../scripts/README.md)

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

