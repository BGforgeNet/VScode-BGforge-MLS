/**
 * Tests for ids-to-yaml module: IDS list file to YAML conversion.
 */

import { describe, expect, it } from "vitest";
import { parseIdsFile } from "../src/ids-to-yaml.ts";

describe("parseIdsFile", () => {
    it("parses standard IDS lines", () => {
        const content = "0 None\n1 Foo\n2 Bar\n";
        const result = parseIdsFile(content, "test.ids");
        expect(result).toEqual([
            { name: "None", detail: "0", doc: "test.ids" },
            { name: "Foo", detail: "1", doc: "test.ids" },
            { name: "Bar", detail: "2", doc: "test.ids" },
        ]);
    });

    it("skips empty lines", () => {
        const content = "0 A\n\n1 B\n";
        const result = parseIdsFile(content, "doc");
        expect(result).toHaveLength(2);
    });

    it("skips lines with wrong number of parts", () => {
        const content = "0 A\nonly_one\n1 B C extra\n2 D\n";
        const result = parseIdsFile(content, "doc");
        expect(result).toHaveLength(2);
        expect(result[0]!.name).toBe("A");
        expect(result[1]!.name).toBe("D");
    });

    it("handles whitespace-only lines", () => {
        const content = "   \n0 A\n  \t  \n";
        const result = parseIdsFile(content, "doc");
        expect(result).toHaveLength(1);
    });

    it("returns empty array for empty content", () => {
        expect(parseIdsFile("", "doc")).toEqual([]);
    });

    it("uses the provided doc value", () => {
        const result = parseIdsFile("0 X\n", "align.ids");
        expect(result[0]!.doc).toBe("align.ids");
    });
});
