# Binary Parsers

Extensible system for parsing binary file formats.

## Architecture

- `types.ts` - Interfaces: `BinaryParser`, `ParseResult`, `ParsedGroup`, `ParsedField`
- `registry.ts` - `ParserRegistry` maps file extensions to parsers
- `index.ts` - Exports and registers all parsers

## Adding a new format

1. Create `<format>.ts` implementing `BinaryParser`
2. Register in `index.ts`: `parserRegistry.register(myParser)`
3. Add extension pattern to `package.json` customEditors selector

## CLI

```bash
node cli/bin/out/bin-cli.js <file>           # dump to stdout (requires pnpm build first)
node cli/bin/out/bin-cli.js <file> --save    # save to <basename>.json
node cli/bin/out/bin-cli.js <file> --check   # verify against saved json
```

## Testing

```bash
pnpm test:cli              # CLI mode tests (check/save/stdout exit codes, diff output)
```
