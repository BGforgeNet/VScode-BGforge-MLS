import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { mapParser } from "../src/parsers/map";
import { buildBinaryEditorParseResult } from "../src/editors/binaryEditor-viewModel";
import type { ParseResult } from "../src/parsers/types";

function makeProResult(): ParseResult {
    return {
        format: "pro",
        formatName: "Fallout PRO (Prototype)",
        root: {
            name: "PRO File",
            fields: [
                {
                    name: "Header",
                    expanded: true,
                    fields: [
                        { name: "Object Type", value: "Misc", offset: 0, size: 1, type: "enum", rawValue: 5 },
                        { name: "Text ID", value: 100, offset: 4, size: 4, type: "uint32" },
                    ],
                },
            ],
        },
    };
}

function loadMapResult(mapName: string): ParseResult {
    const mapPath = path.resolve("external/fallout/Fallout2_Restoration_Project/data/maps", mapName);
    return mapParser.parse(new Uint8Array(fs.readFileSync(mapPath)));
}

function findGroup(result: ParseResult, groupName: string): { name: string; fields: unknown[] } {
    const group = result.root.fields.find((field) =>
        field && typeof field === "object" && "name" in field && field.name === groupName
    );

    expect(group).toBeDefined();
    expect(group && typeof group === "object" && "fields" in group).toBe(true);
    return group as { name: string; fields: unknown[] };
}

function findFieldValue(fields: unknown[], fieldName: string): unknown {
    const field = fields.find((entry) =>
        entry && typeof entry === "object" && "name" in entry && entry.name === fieldName
    );
    expect(field).toBeDefined();
    expect(field && typeof field === "object" && "value" in field).toBe(true);
    return (field as { value: unknown }).value;
}

describe("buildBinaryEditorParseResult", () => {
    it("leaves non-MAP parse results unchanged", () => {
        const proResult = makeProResult();
        expect(buildBinaryEditorParseResult(proResult)).toBe(proResult);
    });

    it("compacts real MAP parse results into summaries", () => {
        const fullResult = loadMapResult("artemple.map");
        const compactResult = buildBinaryEditorParseResult(fullResult);
        const fullTilesGroup = findGroup(fullResult, "Elevation 0 Tiles");
        const fullTimerScriptsGroup = findGroup(fullResult, "Timer Scripts");
        const fullObjectsGroup = findGroup(fullResult, "Objects Section");

        expect(compactResult).not.toBe(fullResult);
        expect(compactResult.format).toBe("map");
        expect(compactResult.root.fields.map((field) => field.name)).toEqual([
            "Header",
            "Tiles",
            "Scripts",
            "Objects",
        ]);

        const tilesGroup = findGroup(compactResult, "Tiles");
        expect(findFieldValue(tilesGroup.fields, "Elevation 0 Non-Default Tiles")).toBe(fullTilesGroup.fields.length / 4);

        const scriptsGroup = findGroup(compactResult, "Scripts");
        expect(findFieldValue(scriptsGroup.fields, "Timer Scripts")).toBe(fullTimerScriptsGroup.fields.length);

        const objectsGroup = findGroup(compactResult, "Objects");
        expect(findFieldValue(objectsGroup.fields, "Total Objects")).toBe(findFieldValue(fullObjectsGroup.fields, "Total Objects"));
        expect(findFieldValue(objectsGroup.fields, "TODO")).toBe("Full object browsing requires lazy loading and PRO-backed subtype resolution.");
    });

    it("substantially reduces MAP init payload size", () => {
        const fullResult = loadMapResult("navarro.map");
        const compactResult = buildBinaryEditorParseResult(fullResult);

        const fullBytes = Buffer.byteLength(JSON.stringify(fullResult));
        const compactBytes = Buffer.byteLength(JSON.stringify(compactResult));

        expect(fullBytes).toBeGreaterThan(9_000_000);
        expect(compactBytes).toBeLessThan(50_000);
    });
});
