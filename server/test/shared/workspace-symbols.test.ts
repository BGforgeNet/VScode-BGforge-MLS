/**
 * Tests for shared/workspace-symbols.ts - WorkspaceSymbolIndex.
 *
 * Tests the index that stores and searches workspace-wide symbols
 * for the Ctrl+T workspace symbol feature.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { DocumentSymbol, SymbolKind } from "vscode-languageserver/node";
import { WorkspaceSymbolIndex } from "../../src/shared/workspace-symbols";

// =============================================================================
// Test fixtures
// =============================================================================

function makeDocSymbol(name: string, kind: SymbolKind = SymbolKind.Function): DocumentSymbol {
    return {
        name,
        kind,
        range: { start: { line: 0, character: 0 }, end: { line: 5, character: 1 } },
        selectionRange: { start: { line: 0, character: 10 }, end: { line: 0, character: 10 + name.length } },
    };
}

const URI_A = "file:///workspace/a.ssl";
const URI_B = "file:///workspace/b.ssl";

describe("WorkspaceSymbolIndex", () => {
    let index: WorkspaceSymbolIndex;

    beforeEach(() => {
        index = new WorkspaceSymbolIndex();
    });

    // =========================================================================
    // updateFile / removeFile
    // =========================================================================

    describe("updateFile()", () => {
        it("should store symbols for a file", () => {
            index.updateFile(URI_A, [makeDocSymbol("my_proc")]);

            const results = index.search("");
            expect(results).toHaveLength(1);
            expect(results[0].name).toBe("my_proc");
            expect(results[0].location.uri).toBe(URI_A);
        });

        it("should replace symbols when updating same file", () => {
            index.updateFile(URI_A, [makeDocSymbol("old_proc")]);
            index.updateFile(URI_A, [makeDocSymbol("new_proc")]);

            const results = index.search("");
            expect(results).toHaveLength(1);
            expect(results[0].name).toBe("new_proc");
        });

        it("should keep symbols from other files when updating", () => {
            index.updateFile(URI_A, [makeDocSymbol("proc_a")]);
            index.updateFile(URI_B, [makeDocSymbol("proc_b")]);

            const results = index.search("");
            expect(results).toHaveLength(2);
            expect(results.map(s => s.name)).toContain("proc_a");
            expect(results.map(s => s.name)).toContain("proc_b");
        });

        it("should convert DocumentSymbol kind to SymbolInformation kind", () => {
            index.updateFile(URI_A, [
                makeDocSymbol("my_func", SymbolKind.Function),
                makeDocSymbol("MY_CONST", SymbolKind.Constant),
                makeDocSymbol("my_var", SymbolKind.Variable),
            ]);

            const results = index.search("");
            const byName = new Map(results.map(s => [s.name, s]));
            expect(byName.get("my_func")!.kind).toBe(SymbolKind.Function);
            expect(byName.get("MY_CONST")!.kind).toBe(SymbolKind.Constant);
            expect(byName.get("my_var")!.kind).toBe(SymbolKind.Variable);
        });

        it("should preserve location range from DocumentSymbol selectionRange", () => {
            const docSym: DocumentSymbol = {
                name: "target",
                kind: SymbolKind.Function,
                range: { start: { line: 10, character: 0 }, end: { line: 20, character: 1 } },
                selectionRange: { start: { line: 10, character: 10 }, end: { line: 10, character: 16 } },
            };
            index.updateFile(URI_A, [docSym]);

            const results = index.search("");
            expect(results[0].location.range).toEqual(docSym.selectionRange);
        });

        it("should handle empty symbol list", () => {
            index.updateFile(URI_A, [makeDocSymbol("proc_a")]);
            index.updateFile(URI_A, []);

            const results = index.search("");
            expect(results).toHaveLength(0);
        });
    });

    describe("removeFile()", () => {
        it("should remove all symbols for a file", () => {
            index.updateFile(URI_A, [makeDocSymbol("proc_a")]);
            index.updateFile(URI_B, [makeDocSymbol("proc_b")]);

            index.removeFile(URI_A);

            const results = index.search("");
            expect(results).toHaveLength(1);
            expect(results[0].name).toBe("proc_b");
        });

        it("should do nothing for unknown file", () => {
            index.updateFile(URI_A, [makeDocSymbol("proc_a")]);

            index.removeFile("file:///unknown.ssl");

            const results = index.search("");
            expect(results).toHaveLength(1);
        });
    });

    // =========================================================================
    // search
    // =========================================================================

    describe("search()", () => {
        beforeEach(() => {
            index.updateFile(URI_A, [
                makeDocSymbol("calculate_damage"),
                makeDocSymbol("apply_armor"),
                makeDocSymbol("MY_MACRO"),
            ]);
            index.updateFile(URI_B, [
                makeDocSymbol("calculate_hit_chance"),
                makeDocSymbol("get_armor_class"),
            ]);
        });

        it("should return all symbols for empty query", () => {
            const results = index.search("");
            expect(results).toHaveLength(5);
        });

        it("should filter by case-insensitive substring", () => {
            const results = index.search("calc");
            expect(results).toHaveLength(2);
            expect(results.map(s => s.name)).toContain("calculate_damage");
            expect(results.map(s => s.name)).toContain("calculate_hit_chance");
        });

        it("should be case-insensitive", () => {
            const results = index.search("my_macro");
            expect(results).toHaveLength(1);
            expect(results[0].name).toBe("MY_MACRO");
        });

        it("should match anywhere in the name", () => {
            const results = index.search("armor");
            expect(results).toHaveLength(2);
            expect(results.map(s => s.name)).toContain("apply_armor");
            expect(results.map(s => s.name)).toContain("get_armor_class");
        });

        it("should return empty array when nothing matches", () => {
            const results = index.search("nonexistent");
            expect(results).toHaveLength(0);
        });

        it("should cap results at maxResults", () => {
            const manySymbols = Array.from({ length: 10 }, (_, i) => makeDocSymbol(`sym_${i}`));
            index.updateFile(URI_A, manySymbols);

            const results = index.search("", 3);
            expect(results).toHaveLength(3);
        });

        it("should return results from multiple files", () => {
            const results = index.search("calculate");
            const uris = results.map(s => s.location.uri);
            expect(uris).toContain(URI_A);
            expect(uris).toContain(URI_B);
        });

        it("should not index DocumentSymbol children", () => {
            const parentWithChildren: DocumentSymbol = {
                name: "my_proc",
                kind: SymbolKind.Function,
                range: { start: { line: 0, character: 0 }, end: { line: 10, character: 1 } },
                selectionRange: { start: { line: 0, character: 10 }, end: { line: 0, character: 17 } },
                children: [
                    {
                        name: "local_var",
                        detail: "my_proc",
                        kind: SymbolKind.Variable,
                        range: { start: { line: 1, character: 4 }, end: { line: 1, character: 20 } },
                        selectionRange: { start: { line: 1, character: 13 }, end: { line: 1, character: 22 } },
                    },
                ],
            };
            const freshIndex = new WorkspaceSymbolIndex();
            freshIndex.updateFile(URI_A, [parentWithChildren]);

            const allResults = freshIndex.search("");
            expect(allResults).toHaveLength(1);
            expect(allResults[0].name).toBe("my_proc");

            const childResults = freshIndex.search("local_var");
            expect(childResults).toHaveLength(0);
        });
    });
});
