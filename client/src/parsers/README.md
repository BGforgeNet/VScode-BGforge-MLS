# Binary Parsers

Extensible system for parsing binary file formats.

## Architecture

- `types.ts` - Interfaces: `BinaryParser`, `ParseResult`, `ParsedGroup`, `ParsedField`
- `registry.ts` - `ParserRegistry` maps file extensions to parsers
- `index.ts` - Exports and registers all parsers
- `pro-canonical.ts` / `map-canonical.ts` - Canonical machine data models used for JSON snapshots and serialization
- `pro-json-snapshot.ts` / `map-json-snapshot.ts` - Format-specific snapshot adapters
- `presentation-schema.ts` - Format-specific presentation metadata for labels, enum/flag options, numeric formatting, and editability

## Adding a new format

1. Create `<format>.ts` implementing `BinaryParser`
2. Register in `index.ts`: `parserRegistry.register(myParser)`
3. Add extension pattern to `package.json` customEditors selector

## New Binary Format Checklist

Use this end-to-end checklist when adding a new binary format to avoid missing one of the hard-linked layers.

1. Parser and registry

- Add `client/src/parsers/<format>.ts` implementing `BinaryParser` (`id`, `name`, `extensions`, `parse`, optional `serialize`).
- Register the parser in `client/src/parsers/index.ts`.
- Ensure extension mapping is reachable from the binary editor (`parserRegistry.getByExtension(...)`).

2. Canonical model and serializer

- Add `client/src/parsers/<format>-canonical.ts` with a strict schema (`zod`), rebuild helpers, and serializer.
- Ensure parser output populates `ParseResult.document` with the canonical document.
- Ensure serializer prefers canonical document data over display tree data.

3. Snapshot adapter

- Add `client/src/parsers/<format>-json-snapshot.ts` with:
    - `createCanonical<Format>JsonSnapshot(parseResult)`
    - `loadCanonical<Format>JsonSnapshot(jsonText, parseOptions?)`
- Enforce round-trip checks: `snapshot -> bytes -> parse -> snapshot` semantic equality.

4. Shared snapshot routing

- Wire `createBinaryJsonSnapshot(...)` / `loadBinaryJsonSnapshot(...)` in `json-snapshot.ts` for the new format.
- Keep fallback generic snapshot handling only for non-canonical formats.

5. Presentation schema (editor-facing metadata)

- Add format schema entry in `presentation-schema.ts`:
    - enum/flags lookup tables
    - numeric formatting
    - editability rules
    - semantic key mapping behavior
- Ensure field identity does not depend on display names alone.

6. Binary editor integration

- Validate tree projection behavior in `binaryEditor-tree.ts` (hide/projection rules if needed).
- Verify edit pipeline supports field validation and display/raw conversions for the new format.
- Verify structural edits (if any) trigger full refresh correctly.

7. CLI and docs

- Confirm `bin-cli` dump/check/load works for the new format and sidecar path behavior.
- Update `docs/architecture.md` binary editor snapshot contract notes if behavior differs.

8. Tests

- Add/extend:
    - parser round-trip tests
    - snapshot dump/load tests
    - editor document edit/undo tests
    - lookup/presentation tests
    - CLI tests (`--save`, `--check`, `--load`)

## JSON snapshots

- Snapshots are canonical `schemaVersion: 1` documents, not raw `ParseResult` dumps.
- `ParseResult.root` remains the editor/display tree.
- `ParseResult.document` is the canonical data model when a format has one.
- `pro` and `map` snapshots are semantic documents. Normal decoded fields do not persist parser layout metadata such as `offset`, `size`, `valueType`, or `nodeType`.
- `opaqueRanges` remain the explicit place where byte offsets and sizes are preserved for undecoded or intentionally omitted regions.
- Presentation metadata is separate from canonical data and is resolved from `presentation-schema.ts`.
- Presentation lookups use stable semantic field IDs such as `pro.header.objectType` and `map.objects.elevations[].objects[].base.pid`, not escaped display-path keys.
- Binary serialization should prefer the canonical document over the display tree.
- Dump and load must validate against the format schema and re-parse bytes as a round-trip check.

## CLI

```bash
node cli/bin/out/bin-cli.js <file>           # dump to stdout (requires pnpm build first)
node cli/bin/out/bin-cli.js <file> --save    # save to <file>.<ext>.json
node cli/bin/out/bin-cli.js <file> --check   # verify against saved canonical json
node cli/bin/out/bin-cli.js <file>.json --load
```

Notes:

- Sidecars preserve the original extension: `file.pro -> file.pro.json`, `file.map -> file.map.json`.
- `--load` does not support legacy snapshots without `schemaVersion`.
- Ambiguous MAP snapshots still require `--graceful-map` again on load.

## Extensibility Refactor Plan

Current architecture is extensible but still hardcodes `pro`/`map` in a few places. The plan below removes those switches while keeping current behavior.

1. Introduce a format adapter registry

- Define a `BinaryFormatAdapter` interface (canonical snapshot create/load, optional presentation schema, optional editor projection hooks).
- Register adapters by parser `id`.

2. Move snapshot routing from hardcoded switches to adapter lookup

- Replace format `if (format === "pro" | "map")` branches in `json-snapshot.ts` with adapter dispatch.
- Keep generic v1 snapshot fallback only when no adapter exists.

3. Decouple canonical document typing from a fixed union

- Replace `BinaryCanonicalDocument = ProCanonicalDocument | MapCanonicalDocument` with an extensible type strategy:
    - either `unknown` at `ParseResult.document` boundary + adapter-level validation, or
    - a map-style generic keyed by format id.

4. Move presentation schema to per-format registration

- Register `FormatPresentationSchema` via adapter instead of `if (format === "pro" || format === "map")`.
- Keep shared helper utilities (`resolveFieldPresentation`, option conversion) generic.

5. Isolate format-specific editor projection logic

- Keep common tree traversal generic.
- Move format-specific hide/group transforms (for example MAP tile projection) behind adapter hooks.

6. Migration strategy

- Phase 1: Introduce adapter registry with `pro` and `map` backfills.
- Phase 2: Switch snapshot/presentation dispatch to adapters.
- Phase 3: Remove old hardcoded branches and dead helper code.
- Phase 4: Add one pilot third format to validate the new extension path.

## Testing

```bash
pnpm test:cli              # CLI mode tests (check/save/stdout exit codes, diff output)
```
