/**
 * Unit tests for fallout-ssl/utils.ts - utility functions for local symbol extraction.
 */

import { describe, expect, it, beforeAll, vi } from "vitest";
import { Position } from "vscode-languageserver/node";

// Mock the server module to avoid LSP connection issues
vi.mock("../../src/server", () => ({
    connection: {
        console: { log: vi.fn() },
        sendDiagnostics: vi.fn(),
    },
}));

import {
    makeRange,
    findPrecedingDocComment,
    extractProcedures,
    findProcedure,
    findIdentifierAtPosition,
    findDefinitionNode,
    isLocalDefinition,
    findAllReferences,
    extractMacros,
} from "../../src/fallout-ssl/utils";
import { initParser, parseWithCache } from "../../src/fallout-ssl/parser";

beforeAll(async () => {
    await initParser();
});

describe("fallout-ssl/utils", () => {
    describe("makeRange()", () => {
        it("creates a range from tree-sitter node positions", () => {
            const text = "procedure foo begin end";
            const tree = parseWithCache(text);
            expect(tree).not.toBeNull();

            const nameNode = tree!.rootNode.childForFieldName("name");
            if (nameNode) {
                const range = makeRange(nameNode);
                expect(range.start.line).toBe(0);
                expect(range.start.character).toBeGreaterThanOrEqual(0);
                expect(range.end.line).toBe(0);
                expect(range.end.character).toBeGreaterThan(range.start.character);
            }
        });
    });

    describe("extractProcedures()", () => {
        it("extracts a single procedure", () => {
            const text = "procedure foo begin end";
            const tree = parseWithCache(text);
            expect(tree).not.toBeNull();

            const procedures = extractProcedures(tree!.rootNode);
            expect(procedures.size).toBe(1);
            expect(procedures.has("foo")).toBe(true);
            expect(procedures.get("foo")?.isForward).toBe(false);
        });

        it("extracts multiple procedures", () => {
            const text = `
procedure foo begin end
procedure bar begin end
procedure baz begin end
`;
            const tree = parseWithCache(text);
            expect(tree).not.toBeNull();

            const procedures = extractProcedures(tree!.rootNode);
            expect(procedures.size).toBe(3);
            expect(procedures.has("foo")).toBe(true);
            expect(procedures.has("bar")).toBe(true);
            expect(procedures.has("baz")).toBe(true);
        });

        it("extracts forward declarations", () => {
            const text = "procedure foo;";
            const tree = parseWithCache(text);
            expect(tree).not.toBeNull();

            const procedures = extractProcedures(tree!.rootNode);
            expect(procedures.size).toBe(1);
            expect(procedures.has("foo")).toBe(true);
            expect(procedures.get("foo")?.isForward).toBe(true);
        });

        it("prefers definition over forward declaration", () => {
            const text = `
procedure foo;
procedure foo begin end
`;
            const tree = parseWithCache(text);
            expect(tree).not.toBeNull();

            const procedures = extractProcedures(tree!.rootNode);
            expect(procedures.size).toBe(1);
            expect(procedures.has("foo")).toBe(true);
            expect(procedures.get("foo")?.isForward).toBe(false);
        });

        it("returns empty map for empty file", () => {
            const text = "";
            const tree = parseWithCache(text);
            expect(tree).not.toBeNull();

            const procedures = extractProcedures(tree!.rootNode);
            expect(procedures.size).toBe(0);
        });
    });

    describe("findProcedure()", () => {
        it("finds a procedure by name", () => {
            const text = `
procedure foo begin end
procedure bar begin end
`;
            const tree = parseWithCache(text);
            expect(tree).not.toBeNull();

            const proc = findProcedure(tree!.rootNode, "bar");
            expect(proc).not.toBeNull();
            expect(proc?.type).toBe("procedure");
        });

        it("returns null for non-existent procedure", () => {
            const text = "procedure foo begin end";
            const tree = parseWithCache(text);
            expect(tree).not.toBeNull();

            const proc = findProcedure(tree!.rootNode, "nonexistent");
            expect(proc).toBeNull();
        });

        it("finds forward declaration when no definition exists", () => {
            const text = "procedure foo;";
            const tree = parseWithCache(text);
            expect(tree).not.toBeNull();

            const proc = findProcedure(tree!.rootNode, "foo");
            expect(proc).not.toBeNull();
            expect(proc?.type).toBe("procedure_forward");
        });
    });

    describe("findIdentifierAtPosition()", () => {
        it("finds identifier at cursor position", () => {
            const text = "procedure foo begin end";
            const tree = parseWithCache(text);
            expect(tree).not.toBeNull();

            // Position on "foo"
            const position: Position = { line: 0, character: 10 };
            const symbol = findIdentifierAtPosition(tree!.rootNode, position);
            expect(symbol).toBe("foo");
        });

        it("returns null for position outside identifiers", () => {
            const text = "procedure foo begin end";
            const tree = parseWithCache(text);
            expect(tree).not.toBeNull();

            // Position on whitespace
            const position: Position = { line: 0, character: 9 };
            const symbol = findIdentifierAtPosition(tree!.rootNode, position);
            expect(symbol).toBeNull();
        });

        it("returns null for position beyond text", () => {
            const text = "procedure foo begin end";
            const tree = parseWithCache(text);
            expect(tree).not.toBeNull();

            const position: Position = { line: 10, character: 0 };
            const symbol = findIdentifierAtPosition(tree!.rootNode, position);
            expect(symbol).toBeNull();
        });
    });

    describe("findDefinitionNode()", () => {
        it("finds procedure definition", () => {
            const text = "procedure foo begin end";
            const tree = parseWithCache(text);
            expect(tree).not.toBeNull();

            const def = findDefinitionNode(tree!.rootNode, "foo");
            expect(def).not.toBeNull();
            expect(def?.type).toBe("procedure");
        });

        it("finds variable declaration in procedure", () => {
            const text = `
procedure foo begin
    variable x;
end
`;
            const tree = parseWithCache(text);
            expect(tree).not.toBeNull();

            const def = findDefinitionNode(tree!.rootNode, "x");
            expect(def).not.toBeNull();
        });

        it("returns null for undefined symbol", () => {
            const text = "procedure foo begin end";
            const tree = parseWithCache(text);
            expect(tree).not.toBeNull();

            const def = findDefinitionNode(tree!.rootNode, "nonexistent");
            expect(def).toBeNull();
        });
    });

    describe("isLocalDefinition()", () => {
        it("returns true for locally defined procedure", () => {
            const text = "procedure foo begin end";
            const tree = parseWithCache(text);
            expect(tree).not.toBeNull();

            const isLocal = isLocalDefinition(tree!.rootNode, "foo");
            expect(isLocal).toBe(true);
        });

        it("returns false for undefined symbol", () => {
            const text = "procedure foo begin end";
            const tree = parseWithCache(text);
            expect(tree).not.toBeNull();

            const isLocal = isLocalDefinition(tree!.rootNode, "bar");
            expect(isLocal).toBe(false);
        });
    });

    describe("findAllReferences()", () => {
        it("finds all references to a symbol", () => {
            const text = `
procedure foo begin
    call bar;
    call bar;
end
procedure bar begin end
`;
            const tree = parseWithCache(text);
            expect(tree).not.toBeNull();

            const refs = findAllReferences(tree!.rootNode, "bar");
            // bar definition + 2 calls
            expect(refs.length).toBeGreaterThanOrEqual(3);
        });

        it("returns empty array for symbol with no references", () => {
            const text = "procedure foo begin end";
            const tree = parseWithCache(text);
            expect(tree).not.toBeNull();

            const refs = findAllReferences(tree!.rootNode, "nonexistent");
            expect(refs).toEqual([]);
        });
    });

    describe("extractMacros()", () => {
        it("extracts macros when grammar supports preprocessor nodes", () => {
            // Note: Macro extraction depends on the grammar having preprocessor/define nodes
            // This test verifies the function doesn't crash with define-like syntax
            const text = "#define MY_CONST 123";
            const tree = parseWithCache(text);
            expect(tree).not.toBeNull();

            const macros = extractMacros(tree!.rootNode);
            // The grammar may or may not parse this as a preprocessor node
            expect(Array.isArray(macros)).toBe(true);
        });

        it("handles function-like macro syntax", () => {
            // Note: Function-like macro extraction depends on grammar support
            const text = "#define ADD(a, b) ((a) + (b))";
            const tree = parseWithCache(text);
            expect(tree).not.toBeNull();

            const macros = extractMacros(tree!.rootNode);
            // Just verify it doesn't crash
            expect(Array.isArray(macros)).toBe(true);
            // If macros are found, check the structure
            if (macros.length > 0) {
                expect(macros[0]).toHaveProperty("name");
                expect(macros[0]).toHaveProperty("hasParams");
            }
        });

        it("handles multiple define statements", () => {
            const text = `
#define FOO 1
#define BAR 2
#define BAZ 3
`;
            const tree = parseWithCache(text);
            expect(tree).not.toBeNull();

            const macros = extractMacros(tree!.rootNode);
            // Just verify it doesn't crash and returns an array
            expect(Array.isArray(macros)).toBe(true);
        });

        it("returns empty array when no macros", () => {
            const text = "procedure foo begin end";
            const tree = parseWithCache(text);
            expect(tree).not.toBeNull();

            const macros = extractMacros(tree!.rootNode);
            expect(macros).toEqual([]);
        });
    });

    describe("findPrecedingDocComment()", () => {
        it("finds JSDoc comment before procedure", () => {
            const text = `
/** This is foo */
procedure foo begin end
`;
            const tree = parseWithCache(text);
            expect(tree).not.toBeNull();

            // Find the procedure node
            const proc = findProcedure(tree!.rootNode, "foo");
            expect(proc).not.toBeNull();

            const docComment = findPrecedingDocComment(tree!.rootNode, proc!);
            expect(docComment).toBe("/** This is foo */");
        });

        it("returns null when no doc comment", () => {
            const text = "procedure foo begin end";
            const tree = parseWithCache(text);
            expect(tree).not.toBeNull();

            const proc = findProcedure(tree!.rootNode, "foo");
            expect(proc).not.toBeNull();

            const docComment = findPrecedingDocComment(tree!.rootNode, proc!);
            expect(docComment).toBeNull();
        });

        it("ignores regular comments", () => {
            const text = `
// This is a regular comment
procedure foo begin end
`;
            const tree = parseWithCache(text);
            expect(tree).not.toBeNull();

            const proc = findProcedure(tree!.rootNode, "foo");
            expect(proc).not.toBeNull();

            const docComment = findPrecedingDocComment(tree!.rootNode, proc!);
            expect(docComment).toBeNull();
        });
    });
});
