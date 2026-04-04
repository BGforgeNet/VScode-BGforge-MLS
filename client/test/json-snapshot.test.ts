import { describe, expect, it } from "vitest";
import type { ParseResult } from "../src/parsers/types";
import { createBinaryJsonSnapshot, parseBinaryJsonSnapshot } from "../src/parsers/json-snapshot";

function makeSnapshotResult(): ParseResult {
    return {
        format: "map",
        formatName: "Fallout MAP",
        root: {
            name: "MAP File",
            fields: [
                {
                    name: "Header",
                    expanded: true,
                    fields: [
                        { name: "Version", value: 20, offset: 0, size: 4, type: "uint32" },
                    ],
                },
            ],
        },
        opaqueRanges: [
            {
                label: "objects-tail",
                offset: 64,
                size: 32,
                hexChunks: ["00112233", "44556677"],
            },
        ],
    };
}

describe("json-snapshot", () => {
    it("serializes parse results with a trailing newline", () => {
        const json = createBinaryJsonSnapshot(makeSnapshotResult());
        expect(json.endsWith("\n")).toBe(true);
        expect(json).toContain("\"opaqueRanges\"");
    });

    it("parses serialized snapshots back into parse results", () => {
        const original = makeSnapshotResult();
        const parsed = parseBinaryJsonSnapshot(createBinaryJsonSnapshot(original));
        expect(parsed).toEqual(original);
    });
});
