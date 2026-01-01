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
pnpx tsx client/src/bin-cli.ts <file>           # dump to stdout
pnpx tsx client/src/bin-cli.ts <file> --save    # save to <basename>.json
pnpx tsx client/src/bin-cli.ts <file> --check   # verify against saved json
```

## Testing

```bash
pnpm test-bin              # check all against saved json (default)
pnpm test-bin -- --save    # regenerate all json fixtures
```
