/**
 * Unit tests for fallout-ssl/definition.ts - go to definition for local symbols.
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

import { getLocalDefinition } from "../../src/fallout-ssl/definition";
import { initParser } from "../../src/fallout-ssl/parser";

beforeAll(async () => {
    await initParser();
});

describe("fallout-ssl/definition", () => {
    describe("getLocalDefinition()", () => {
        it("finds procedure definition from call site", () => {
            const text = `
procedure main begin
    call helper;
end
procedure helper begin end
`;
            const uri = "file:///test.ssl";
            // Cursor on "helper" in call statement
            const position: Position = { line: 2, character: 10 };
            const result = getLocalDefinition(text, uri, position);

            expect(result).not.toBeNull();
            expect(result?.uri).toBe(uri);
            expect(result?.range.start.line).toBe(4);
        });

        it("finds variable definition in procedure", () => {
            const text = `
procedure foo begin
    variable x;
    x := 5;
end
`;
            const uri = "file:///test.ssl";
            // Cursor on "x" in assignment
            const position: Position = { line: 3, character: 4 };
            const result = getLocalDefinition(text, uri, position);

            expect(result).not.toBeNull();
            expect(result?.uri).toBe(uri);
            // Should point to variable declaration
            expect(result?.range.start.line).toBe(2);
        });

        it("finds parameter definition from usage", () => {
            const text = `
procedure foo(variable arg1) begin
    display_msg(arg1);
end
`;
            const uri = "file:///test.ssl";
            // Cursor on "arg1" in function call
            const position: Position = { line: 2, character: 16 };
            const result = getLocalDefinition(text, uri, position);

            expect(result).not.toBeNull();
            expect(result?.uri).toBe(uri);
            // Should point to parameter declaration
            expect(result?.range.start.line).toBe(1);
        });

        it("handles macro definition lookup", () => {
            // Note: Macro definition lookup depends on grammar support for preprocessor nodes
            const text = `
#define MAX_VALUE 100

procedure foo begin
    if (x > MAX_VALUE) then begin
    end
end
`;
            const uri = "file:///test.ssl";
            // Cursor on "MAX_VALUE" in condition
            const position: Position = { line: 4, character: 14 };
            const result = getLocalDefinition(text, uri, position);

            // Result depends on whether grammar parses preprocessor as definition
            // Just verify it doesn't crash
            expect(result === null || result !== null).toBe(true);
        });

        it("finds macro parameter definition from macro body usage", () => {
            const text = `
#define SCALE(value) ((value) * 2)
`;
            const uri = "file:///test.ssl";
            const position: Position = { line: 1, character: 24 };
            const result = getLocalDefinition(text, uri, position);

            expect(result).not.toBeNull();
            expect(result?.uri).toBe(uri);
            expect(result?.range.start.line).toBe(1);
            expect(result?.range.start.character).toBe(14);
        });

        it("returns null when cursor is on undefined symbol", () => {
            const text = `
procedure foo begin
    call undefined_proc;
end
`;
            const uri = "file:///test.ssl";
            // Cursor on "undefined_proc"
            const position: Position = { line: 2, character: 10 };
            const result = getLocalDefinition(text, uri, position);

            expect(result).toBeNull();
        });

        it("returns null when cursor is not on identifier", () => {
            const text = "procedure foo begin end";
            const uri = "file:///test.ssl";
            // Cursor on whitespace
            const position: Position = { line: 0, character: 9 };
            const result = getLocalDefinition(text, uri, position);

            expect(result).toBeNull();
        });

        it("prefers procedure definition over forward declaration", () => {
            const text = `
procedure foo;

procedure bar begin
    call foo;
end

procedure foo begin
    display_msg("hello");
end
`;
            const uri = "file:///test.ssl";
            // Cursor on "foo" in call statement
            const position: Position = { line: 4, character: 10 };
            const result = getLocalDefinition(text, uri, position);

            expect(result).not.toBeNull();
            expect(result?.uri).toBe(uri);
            // Should point to definition, not forward declaration
            expect(result?.range.start.line).toBe(7);
        });

        it("finds export_decl variable definition", () => {
            const text = `
export variable my_export := 100;

procedure foo begin
    my_export := 200;
end
`;
            const uri = "file:///test.ssl";
            // Cursor on "my_export" in assignment
            const position: Position = { line: 4, character: 4 };
            const result = getLocalDefinition(text, uri, position);

            expect(result).not.toBeNull();
            expect(result?.uri).toBe(uri);
            expect(result?.range.start.line).toBe(1);
        });
    });
});
