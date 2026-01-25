/**
 * Tests for shared/definition.ts - definition data utilities.
 */

import { describe, expect, it } from "vitest";
import { load, type Definitions } from "../../src/shared/definition";

describe("shared/definition", () => {
    describe("load()", () => {
        it("should create an empty map for empty input", () => {
            const result = load("file:///test.txt", []);

            expect(result.size).toBe(0);
        });

        it("should create a definition map from parsed data", () => {
            const uri = "file:///test.txt";
            const definitions: Definitions = [
                { name: "myFunc", line: 10, start: 0, end: 6 },
            ];

            const result = load(uri, definitions);

            expect(result.size).toBe(1);
            expect(result.get("myFunc")).toEqual({
                uri: "file:///test.txt",
                range: {
                    start: { line: 10, character: 0 },
                    end: { line: 10, character: 6 },
                },
            });
        });

        it("should handle multiple definitions", () => {
            const uri = "file:///test.txt";
            const definitions: Definitions = [
                { name: "func1", line: 5, start: 0, end: 5 },
                { name: "func2", line: 15, start: 4, end: 9 },
                { name: "func3", line: 25, start: 8, end: 13 },
            ];

            const result = load(uri, definitions);

            expect(result.size).toBe(3);
            expect(result.has("func1")).toBe(true);
            expect(result.has("func2")).toBe(true);
            expect(result.has("func3")).toBe(true);
        });

        it("should use the provided URI for all definitions", () => {
            const uri = "file:///my/custom/path.ssl";
            const definitions: Definitions = [
                { name: "proc1", line: 0, start: 0, end: 5 },
                { name: "proc2", line: 10, start: 0, end: 5 },
            ];

            const result = load(uri, definitions);

            for (const [, location] of result) {
                expect(location.uri).toBe(uri);
            }
        });

        it("should set correct line numbers", () => {
            const uri = "file:///test.txt";
            const definitions: Definitions = [
                { name: "zero", line: 0, start: 0, end: 4 },
                { name: "hundred", line: 100, start: 0, end: 7 },
            ];

            const result = load(uri, definitions);

            expect(result.get("zero")?.range.start.line).toBe(0);
            expect(result.get("hundred")?.range.start.line).toBe(100);
        });

        it("should set correct character positions", () => {
            const uri = "file:///test.txt";
            const definitions: Definitions = [
                { name: "indented", line: 5, start: 8, end: 16 },
            ];

            const result = load(uri, definitions);

            const location = result.get("indented");
            expect(location?.range.start.character).toBe(8);
            expect(location?.range.end.character).toBe(16);
        });

        it("should overwrite duplicate names (last wins)", () => {
            const uri = "file:///test.txt";
            const definitions: Definitions = [
                { name: "dup", line: 5, start: 0, end: 3 },
                { name: "dup", line: 10, start: 0, end: 3 },
            ];

            const result = load(uri, definitions);

            expect(result.size).toBe(1);
            expect(result.get("dup")?.range.start.line).toBe(10);
        });
    });
});
