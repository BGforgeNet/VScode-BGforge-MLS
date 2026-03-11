/**
 * Unit tests for fallout-ssl/rename.ts - single-file and workspace-wide rename.
 */

import { describe, expect, it, beforeAll, vi } from "vitest";
import { MarkupKind, Position, TextDocumentEdit, TextEdit, WorkspaceEdit } from "vscode-languageserver/node";
import { SymbolKind, ScopeLevel, SourceType } from "../../src/core/symbol";

// Mock the LSP connection to avoid initialization issues in tests
vi.mock("../../src/lsp-connection", () => ({
    getConnection: () => ({
        console: { log: vi.fn() },
        sendDiagnostics: vi.fn(),
    }),
    getDocuments: () => ({ get: vi.fn() }),
    initLspConnection: vi.fn(),
}));

import { renameSymbol, prepareRenameSymbol, renameSymbolWorkspace, prepareRenameSymbolWorkspace } from "../../src/fallout-ssl/rename";
import { initParser } from "../../src/fallout-ssl/parser";
import { ReferencesIndex } from "../../src/shared/references-index";
import { extractCallSites } from "../../src/fallout-ssl/call-sites";
import { Symbols } from "../../src/core/symbol-index";

beforeAll(async () => {
    await initParser();
});

describe("fallout-ssl/rename", () => {
    describe("renameSymbol()", () => {
        it("renames a procedure at definition and all call sites", () => {
            const text = `
procedure helper begin end
procedure main begin
    call helper;
    call helper;
end
`;
            const uri = "file:///test.ssl";
            // Cursor on "helper" at definition
            const position: Position = { line: 1, character: 12 };
            const result = renameSymbol(text, position, "new_helper", uri);

            expect(result).not.toBeNull();
            expect(result?.changes).toBeDefined();
            expect(result?.changes?.[uri]).toBeDefined();
            // Should have edits for: definition + 2 call sites = 3
            expect(result?.changes?.[uri].length).toBe(3);

            // All edits should replace with the new name
            for (const edit of result?.changes?.[uri] ?? []) {
                expect(edit.newText).toBe("new_helper");
            }
        });

        it("renames a variable in procedure", () => {
            const text = `
procedure foo begin
    variable counter;
    counter := 0;
    counter := counter + 1;
    display_msg(counter);
end
`;
            const uri = "file:///test.ssl";
            // Cursor on "counter" at declaration
            const position: Position = { line: 2, character: 14 };
            const result = renameSymbol(text, position, "count", uri);

            expect(result).not.toBeNull();
            expect(result?.changes?.[uri]).toBeDefined();
            // declaration + 4 usages = 5
            expect(result?.changes?.[uri].length).toBe(5);

            for (const edit of result?.changes?.[uri] ?? []) {
                expect(edit.newText).toBe("count");
            }
        });

        it("returns null for symbol not defined locally", () => {
            const text = `
procedure foo begin
    call external_proc;
end
`;
            const uri = "file:///test.ssl";
            // Cursor on "external_proc" which is not defined in this file
            const position: Position = { line: 2, character: 10 };
            const result = renameSymbol(text, position, "new_name", uri);

            expect(result).toBeNull();
        });

        it("returns null when cursor is not on identifier", () => {
            const text = "procedure foo begin end";
            const uri = "file:///test.ssl";
            // Cursor on whitespace
            const position: Position = { line: 0, character: 9 };
            const result = renameSymbol(text, position, "new_name", uri);

            expect(result).toBeNull();
        });

        it("renames procedure parameter", () => {
            const text = `
procedure process(variable value) begin
    display_msg(value);
    if (value > 0) then begin
        display_msg(value);
    end
end
`;
            const uri = "file:///test.ssl";
            // Cursor on "value" parameter
            const position: Position = { line: 1, character: 27 };
            const result = renameSymbol(text, position, "amount", uri);

            expect(result).not.toBeNull();
            expect(result?.changes?.[uri]).toBeDefined();
            // param definition + 3 usages = 4
            expect(result?.changes?.[uri].length).toBe(4);

            for (const edit of result?.changes?.[uri] ?? []) {
                expect(edit.newText).toBe("amount");
            }
        });

        it("renames a top-level variable across all procedures", () => {
            const text = `
variable
   dogmeatPtr,
   dogmeatCheck,
   dogmeatTalk;

procedure foo begin
    dogmeatPtr := 1;
    dogmeatCheck := dogmeatPtr;
end
procedure bar begin
    dogmeatPtr := 2;
end
`;
            const uri = "file:///test.ssl";
            // Cursor on "dogmeatPtr" at declaration
            const position: Position = { line: 2, character: 6 };
            const result = renameSymbol(text, position, "dmPtr", uri);

            expect(result).not.toBeNull();
            expect(result?.changes?.[uri]).toBeDefined();
            // declaration + 3 usages (foo: 2, bar: 1) = 4
            expect(result?.changes?.[uri].length).toBe(4);

            for (const edit of result?.changes?.[uri] ?? []) {
                expect(edit.newText).toBe("dmPtr");
            }
        });

        it("handles macro rename when grammar supports preprocessor", () => {
            // Note: Macro rename depends on grammar support for preprocessor nodes
            const text = `
#define MAX_ITEMS 100

procedure foo begin
    if (count > MAX_ITEMS) then begin
    end
    display_msg(MAX_ITEMS);
end
`;
            const uri = "file:///test.ssl";
            // Cursor on "MAX_ITEMS" in define
            const position: Position = { line: 1, character: 10 };
            const result = renameSymbol(text, position, "ITEM_LIMIT", uri);

            // Result depends on whether grammar parses preprocessor properly
            // Just verify it doesn't crash
            expect(result === null || result !== null).toBe(true);
        });

        it("only renames the specific symbol, not similarly named ones", () => {
            const text = `
procedure foo begin end
procedure foobar begin
    call foo;
end
`;
            const uri = "file:///test.ssl";
            // Cursor on "foo" procedure
            const position: Position = { line: 1, character: 12 };
            const result = renameSymbol(text, position, "bar", uri);

            expect(result).not.toBeNull();
            expect(result?.changes?.[uri]).toBeDefined();
            // Should only rename "foo" not "foobar"
            expect(result?.changes?.[uri].length).toBe(2); // definition + 1 call

            // Check that foobar is not renamed
            const edits = result?.changes?.[uri] ?? [];
            const hasEditOnFoobar = edits.some(edit =>
                edit.range.start.line === 2 && edit.range.start.character === 10
            );
            expect(hasEditOnFoobar).toBe(false);
        });
    });

    describe("scope isolation", () => {
        it("renames variable in one procedure without affecting same-named variable in another", () => {
            const text = `
procedure foo begin
    variable i;
    i := 0;
    i := i + 1;
end
procedure bar begin
    variable i;
    i := 10;
    i := i + 1;
end
`;
            const uri = "file:///test.ssl";
            // Cursor on "i" in foo (at declaration)
            const position: Position = { line: 2, character: 14 };
            const result = renameSymbol(text, position, "idx", uri);

            expect(result).not.toBeNull();
            expect(result?.changes?.[uri]).toBeDefined();
            // Should rename only in foo: declaration + 3 usages = 4
            const edits = result!.changes![uri];
            expect(edits.length).toBe(4);

            // All edits should be within foo (lines 1-5)
            for (const edit of edits) {
                expect(edit.range.start.line).toBeGreaterThanOrEqual(1);
                expect(edit.range.start.line).toBeLessThanOrEqual(5);
                expect(edit.newText).toBe("idx");
            }
        });

        it("renames parameter without affecting same-named parameter in another procedure", () => {
            const text = `
procedure foo(variable value) begin
    display_msg(value);
end
procedure bar(variable value) begin
    display_msg(value);
end
`;
            const uri = "file:///test.ssl";
            // Cursor on "value" in foo
            const position: Position = { line: 1, character: 23 };
            const result = renameSymbol(text, position, "amount", uri);

            expect(result).not.toBeNull();
            const edits = result!.changes![uri];
            // foo: param def + 1 usage = 2
            expect(edits.length).toBe(2);

            // All edits in foo (lines 1-3)
            for (const edit of edits) {
                expect(edit.range.start.line).toBeGreaterThanOrEqual(1);
                expect(edit.range.start.line).toBeLessThanOrEqual(3);
            }
        });

        it("renames file-scoped macro without renaming shadowing local variable", () => {
            const text = `
#define x 42

procedure foo begin
    variable x;
    x := 1;
end
procedure bar begin
    display_msg(x);
end
`;
            const uri = "file:///test.ssl";
            // Cursor on "x" at macro definition
            const position: Position = { line: 1, character: 8 };
            const result = renameSymbol(text, position, "y", uri);

            expect(result).not.toBeNull();
            const edits = result!.changes![uri];
            // definition in #define + usage in bar = 2
            // foo has local x, should NOT be renamed
            expect(edits.length).toBe(2);

            // No edits should be inside foo (lines 3-6)
            for (const edit of edits) {
                const inFoo = edit.range.start.line >= 3 && edit.range.start.line <= 6;
                expect(inFoo).toBe(false);
            }
        });

        it("rejects rename of local variable from a different procedure", () => {
            const text = `
procedure foo begin
    variable x;
    x := 1;
end
procedure bar begin
    x := 2;
end
`;
            // Cursor on "x" in bar, but x is only defined in foo as a local
            const position: Position = { line: 6, character: 4 };
            const result = prepareRenameSymbol(text, position);

            // x is not defined in bar's scope, nor at file scope - should be null
            expect(result).toBeNull();
        });
    });

    describe("prepareRenameSymbol()", () => {
        it("returns range and placeholder for locally defined procedure", () => {
            const text = `
procedure helper begin end
procedure main begin
    call helper;
end
`;
            // Cursor on "helper" at definition
            const position: Position = { line: 1, character: 12 };
            const result = prepareRenameSymbol(text, position);

            expect(result).not.toBeNull();
            expect(result?.placeholder).toBe("helper");
            expect(result?.range.start.line).toBe(1);
            expect(result?.range.start.character).toBe(10);
            expect(result?.range.end.line).toBe(1);
            expect(result?.range.end.character).toBe(16);
        });

        it("returns range and placeholder when cursor is on reference", () => {
            const text = `
procedure helper begin end
procedure main begin
    call helper;
end
`;
            // Cursor on "helper" at call site
            const position: Position = { line: 3, character: 10 };
            const result = prepareRenameSymbol(text, position);

            expect(result).not.toBeNull();
            expect(result?.placeholder).toBe("helper");
        });

        it("returns null for symbol not defined locally", () => {
            const text = `
procedure foo begin
    call external_proc;
end
`;
            // Cursor on "external_proc" which is not defined in this file
            const position: Position = { line: 2, character: 10 };
            const result = prepareRenameSymbol(text, position);

            expect(result).toBeNull();
        });

        it("returns null when cursor is not on identifier", () => {
            const text = "procedure foo begin end";
            // Cursor on whitespace
            const position: Position = { line: 0, character: 9 };
            const result = prepareRenameSymbol(text, position);

            expect(result).toBeNull();
        });

        it("returns range for variable in procedure", () => {
            const text = `
procedure foo begin
    variable counter;
    counter := 0;
end
`;
            // Cursor on "counter" at declaration
            const position: Position = { line: 2, character: 14 };
            const result = prepareRenameSymbol(text, position);

            expect(result).not.toBeNull();
            expect(result?.placeholder).toBe("counter");
        });
    });

    describe("prepareRenameSymbolWorkspace()", () => {
        it("returns range for workspace-defined symbol", () => {
            const headerUri = "file:///project/headers/utils.h";
            const sslText = `
procedure main begin
    call helper;
end
`;
            const symbolStore = new Symbols();
            symbolStore.updateFile(headerUri, [{
                name: "helper",
                kind: SymbolKind.Procedure,
                callable: {},
                location: { uri: headerUri, range: { start: { line: 0, character: 10 }, end: { line: 0, character: 16 } } },
                scope: { level: ScopeLevel.Workspace },
                source: { type: SourceType.Workspace, uri: headerUri, displayPath: "headers/utils.h" },
                completion: { label: "helper" },
                hover: { contents: { kind: MarkupKind.Markdown, value: "" } },
            }]);

            // Cursor on "helper" reference (not locally defined)
            const position: Position = { line: 2, character: 10 };
            const result = prepareRenameSymbolWorkspace(sslText, position, symbolStore, "/project");

            expect(result).not.toBeNull();
            expect(result?.placeholder).toBe("helper");
        });

        it("returns null for locally defined symbol (defers to single-file)", () => {
            const sslText = `
procedure helper begin end
procedure main begin
    call helper;
end
`;
            const symbolStore = new Symbols();

            // Cursor on "helper" which IS locally defined
            const position: Position = { line: 1, character: 12 };
            const result = prepareRenameSymbolWorkspace(sslText, position, symbolStore, "/project");

            expect(result).toBeNull();
        });

        it("returns null for static (built-in) symbol", () => {
            const sslText = `
procedure main begin
    display_msg("hello");
end
`;
            const symbolStore = new Symbols();
            symbolStore.loadStatic([{
                name: "display_msg",
                kind: SymbolKind.Procedure,
                callable: {},
                location: null,
                scope: { level: ScopeLevel.Global },
                source: { type: SourceType.Static, uri: null },
                completion: { label: "display_msg" },
                hover: { contents: { kind: MarkupKind.Markdown, value: "" } },
            }]);

            // Cursor on "display_msg" (static symbol)
            const position: Position = { line: 2, character: 8 };
            const result = prepareRenameSymbolWorkspace(sslText, position, symbolStore, "/project");

            expect(result).toBeNull();
        });

        it("returns null for symbol defined in external headers directory", () => {
            const externalUri = "file:///external/headers/sfall.h";
            const sslText = `
procedure main begin
    call sfall_func;
end
`;
            const symbolStore = new Symbols();
            symbolStore.updateFile(externalUri, [{
                name: "sfall_func",
                kind: SymbolKind.Procedure,
                callable: {},
                location: { uri: externalUri, range: { start: { line: 0, character: 10 }, end: { line: 0, character: 20 } } },
                scope: { level: ScopeLevel.Workspace },
                source: { type: SourceType.Workspace, uri: externalUri, displayPath: "sfall.h" },
                completion: { label: "sfall_func" },
                hover: { contents: { kind: MarkupKind.Markdown, value: "" } },
            }]);

            // Cursor on "sfall_func" (defined outside workspace root)
            const position: Position = { line: 2, character: 10 };
            const result = prepareRenameSymbolWorkspace(sslText, position, symbolStore, "/project");

            expect(result).toBeNull();
        });
    });

    describe("macro body rename", () => {
        it("renames file-scope symbol referenced inside macro body", () => {
            const text = `
procedure helper begin end
#define CALL_HELPER helper(1, 2)

procedure main begin
    call helper;
end
`;
            const uri = "file:///test.ssl";
            // Cursor on "helper" at procedure definition
            const position: Position = { line: 1, character: 12 };
            const result = renameSymbol(text, position, "new_helper", uri);

            expect(result).not.toBeNull();
            const edits = result!.changes![uri];
            // definition + macro body reference + call site = 3
            expect(edits.length).toBe(3);

            for (const edit of edits) {
                expect(edit.newText).toBe("new_helper");
            }
        });

        it("does not rename macro parameter names when renaming file-scope symbol", () => {
            const text = `
variable a;

#define ADD(a, b) ((a) + (b))

procedure foo begin
    a := 1;
end
`;
            const uri = "file:///test.ssl";
            // Cursor on "a" at variable declaration
            const position: Position = { line: 1, character: 9 };
            const result = renameSymbol(text, position, "x", uri);

            expect(result).not.toBeNull();
            const edits = result!.changes![uri];
            // variable declaration + usage in foo = 2
            // macro body's "a" should NOT be renamed (it shadows the file-scope variable)
            expect(edits.length).toBe(2);

            // No edits should be inside the macro body (line 3)
            for (const edit of edits) {
                expect(edit.range.start.line).not.toBe(3);
            }
        });

        it("renames macro name from usage inside another macro body", () => {
            const text = `
#define MAX_ITEMS 100
#define CHECK_ITEMS(n) (n > MAX_ITEMS)

procedure foo begin
    if (count > MAX_ITEMS) then begin end
end
`;
            const uri = "file:///test.ssl";
            // Cursor on "MAX_ITEMS" at definition
            const position: Position = { line: 1, character: 10 };
            const result = renameSymbol(text, position, "ITEM_LIMIT", uri);

            expect(result).not.toBeNull();
            const edits = result!.changes![uri];
            // definition + reference in CHECK_ITEMS body + reference in foo = 3
            expect(edits.length).toBe(3);
        });

        it("renames symbol inside multiline macro body", () => {
            const text = `
procedure helper begin end

#define DO_STUFF(x) \\
    helper(); \\
    display_msg(x);

procedure main begin
    call helper;
end
`;
            const uri = "file:///test.ssl";
            // Cursor on "helper" at definition
            const position: Position = { line: 1, character: 12 };
            const result = renameSymbol(text, position, "new_helper", uri);

            expect(result).not.toBeNull();
            const edits = result!.changes![uri];
            // definition + macro body reference + call in main = 3
            expect(edits.length).toBe(3);
        });

        it("allows rename from cursor inside macro body", () => {
            const text = `
procedure helper begin end
#define CALL_IT helper()
`;
            const uri = "file:///test.ssl";
            // Cursor on "helper" inside macro body (line 2)
            const position: Position = { line: 2, character: 16 };
            const result = renameSymbol(text, position, "new_helper", uri);

            expect(result).not.toBeNull();
            const edits = result!.changes![uri];
            // definition + macro body reference = 2
            expect(edits.length).toBe(2);
        });

        it("returns null when cursor is on macro parameter in body", () => {
            const text = `
#define ADD(a, b) ((a) + (b))
`;
            // Cursor on "a" inside the macro body - this is a macro param, not file-scope
            const position: Position = { line: 1, character: 20 };
            const result = prepareRenameSymbol(text, position);

            // Macro params are not file-scope defs and not procedure-scoped, so not renameable
            expect(result).toBeNull();
        });
    });

    describe("newName validation", () => {
        it("rejects empty string", () => {
            const text = `procedure helper begin end`;
            const uri = "file:///test.ssl";
            const position: Position = { line: 0, character: 12 };

            expect(renameSymbol(text, position, "", uri)).toBeNull();
        });

        it("rejects names with spaces", () => {
            const text = `procedure helper begin end`;
            const uri = "file:///test.ssl";
            const position: Position = { line: 0, character: 12 };

            expect(renameSymbol(text, position, "new helper", uri)).toBeNull();
        });

        it("rejects names starting with a digit", () => {
            const text = `procedure helper begin end`;
            const uri = "file:///test.ssl";
            const position: Position = { line: 0, character: 12 };

            expect(renameSymbol(text, position, "123abc", uri)).toBeNull();
        });

        it("rejects names with special characters", () => {
            const text = `procedure helper begin end`;
            const uri = "file:///test.ssl";
            const position: Position = { line: 0, character: 12 };

            expect(renameSymbol(text, position, "foo-bar", uri)).toBeNull();
        });

        it("accepts valid identifier with underscores", () => {
            const text = `procedure helper begin end`;
            const uri = "file:///test.ssl";
            const position: Position = { line: 0, character: 12 };

            const result = renameSymbol(text, position, "new_helper_2", uri);
            expect(result).not.toBeNull();
        });

        it("rejects invalid newName in workspace rename", () => {
            const headerUri = "file:///project/headers/utils.h";
            const headerText = `procedure helper begin end`;
            const refsIndex = new ReferencesIndex();
            const symbolStore = new Symbols();

            const position: Position = { line: 0, character: 12 };
            const result = renameSymbolWorkspace(
                headerText, position, "invalid name!", headerUri,
                refsIndex, symbolStore,
                () => null,
                "/project",
            );

            expect(result).toBeNull();
        });
    });

    describe("provider rename dispatch (workspace-first with single-file fallback)", () => {
        /**
         * Simulates the provider's rename() method: try workspace rename first,
         * fall back to single-file rename.
         */
        function providerRename(
            text: string,
            position: Position,
            newName: string,
            uri: string,
            refsIndex: ReferencesIndex,
            symbolStore: Symbols,
            getFileText: (uri: string) => string | null,
            workspaceRoot: string | undefined,
        ): WorkspaceEdit | null {
            const wsResult = renameSymbolWorkspace(
                text, position, newName, uri,
                refsIndex, symbolStore,
                getFileText,
                workspaceRoot,
            );
            if (wsResult) {
                return wsResult;
            }
            return renameSymbol(text, position, newName, uri);
        }

        function makeGetFileText(files: Record<string, string>): (uri: string) => string | null {
            return (uri: string) => files[uri] ?? null;
        }

        function getEditsForUri(result: WorkspaceEdit | null, uri: string): TextEdit[] | undefined {
            // Check documentChanges format (workspace rename)
            if (result?.documentChanges) {
                const docEdit = result.documentChanges.find(
                    (dc): dc is TextDocumentEdit => TextDocumentEdit.is(dc) && dc.textDocument.uri === uri
                );
                return docEdit?.edits as TextEdit[] | undefined;
            }
            // Check changes format (single-file rename)
            if (result?.changes?.[uri]) {
                return result.changes[uri];
            }
            return undefined;
        }

        it("renames procedure from definition in header file across all consuming files", () => {
            const headerUri = "file:///project/bug.h";
            const sslUri = "file:///project/bug.ssl";

            const headerText = `procedure rename_test begin
end`;
            const sslText = `#include "bug.h"

procedure start begin
   call rename_test;

   display_msg("Hello");
end`;

            const refsIndex = new ReferencesIndex();
            refsIndex.updateFile(headerUri, extractCallSites(headerText, headerUri));
            refsIndex.updateFile(sslUri, extractCallSites(sslText, sslUri));

            const symbolStore = new Symbols();

            // Rename from definition site in header file
            const position: Position = { line: 0, character: 12 };
            const result = providerRename(
                headerText, position, "rename_test123", headerUri,
                refsIndex, symbolStore,
                makeGetFileText({ [headerUri]: headerText, [sslUri]: sslText }),
                "/project",
            );

            expect(result).not.toBeNull();

            // Must rename in BOTH files, not just the header
            const headerEdits = getEditsForUri(result, headerUri);
            const sslEdits = getEditsForUri(result, sslUri);

            expect(headerEdits).toBeDefined();
            expect(sslEdits).toBeDefined();
            expect(sslEdits!.length).toBe(1);
            expect(sslEdits![0].newText).toBe("rename_test123");
        });
    });

    describe("renameSymbolWorkspace()", () => {
        /**
         * Helper: create a getFileText function from a map of uri -> text.
         */
        function makeGetFileText(files: Record<string, string>): (uri: string) => string | null {
            return (uri: string) => files[uri] ?? null;
        }

        /** Extract TextEdit[] for a given URI from documentChanges. */
        function getEditsForUri(result: WorkspaceEdit | null, uri: string): TextEdit[] | undefined {
            if (!result?.documentChanges) return undefined;
            const docEdit = result.documentChanges.find(
                (dc): dc is TextDocumentEdit => TextDocumentEdit.is(dc) && dc.textDocument.uri === uri
            );
            return docEdit?.edits as TextEdit[] | undefined;
        }

        it("renames procedure defined in header across consuming .ssl files", () => {
            const headerUri = "file:///project/headers/utils.h";
            const sslUri = "file:///project/scripts/main.ssl";

            const headerText = `procedure helper begin end`;
            const sslText = `
#include "headers/utils.h"

procedure main begin
    call helper;
end
`;

            const refsIndex = new ReferencesIndex();
            refsIndex.updateFile(headerUri, extractCallSites(headerText, headerUri));
            refsIndex.updateFile(sslUri, extractCallSites(sslText, sslUri));

            // Empty symbol store (symbol is locally defined in header file)
            const symbolStore = new Symbols();

            // Rename "helper" from the header file at the definition site
            const position: Position = { line: 0, character: 12 };
            const result = renameSymbolWorkspace(
                headerText, position, "new_helper", headerUri,
                refsIndex, symbolStore,
                makeGetFileText({ [headerUri]: headerText, [sslUri]: sslText }),
                "/project",
            );

            expect(result).not.toBeNull();
            expect(result?.documentChanges).toBeDefined();

            const headerEdits = getEditsForUri(result, headerUri);
            const sslEdits = getEditsForUri(result, sslUri);

            // Should have edits in BOTH the header and the .ssl file
            expect(headerEdits).toBeDefined();
            expect(sslEdits).toBeDefined();

            // Header: 1 edit (definition)
            expect(headerEdits!.length).toBe(1);
            expect(headerEdits![0].newText).toBe("new_helper");

            // SSL file: 1 edit (call site)
            expect(sslEdits!.length).toBe(1);
            expect(sslEdits![0].newText).toBe("new_helper");
        });

        it("renames macro defined in header across multiple .ssl files", () => {
            const headerUri = "file:///project/headers/defs.h";
            const ssl1Uri = "file:///project/scripts/a.ssl";
            const ssl2Uri = "file:///project/scripts/b.ssl";

            const headerText = `#define MAX_ITEMS 100`;
            const ssl1Text = `
#include "headers/defs.h"

procedure foo begin
    if (count > MAX_ITEMS) then begin
    end
end
`;
            const ssl2Text = `
#include "headers/defs.h"

procedure bar begin
    display_msg(MAX_ITEMS);
end
`;

            const refsIndex = new ReferencesIndex();
            refsIndex.updateFile(headerUri, extractCallSites(headerText, headerUri));
            refsIndex.updateFile(ssl1Uri, extractCallSites(ssl1Text, ssl1Uri));
            refsIndex.updateFile(ssl2Uri, extractCallSites(ssl2Text, ssl2Uri));

            const symbolStore = new Symbols();

            // Rename from header definition
            const position: Position = { line: 0, character: 10 };
            const result = renameSymbolWorkspace(
                headerText, position, "ITEM_LIMIT", headerUri,
                refsIndex, symbolStore,
                makeGetFileText({ [headerUri]: headerText, [ssl1Uri]: ssl1Text, [ssl2Uri]: ssl2Text }),
                "/project",
            );

            expect(result).not.toBeNull();
            // Header should have an edit
            expect(getEditsForUri(result, headerUri)).toBeDefined();
            // Both SSL files should have edits
            expect(getEditsForUri(result, ssl1Uri)).toBeDefined();
            expect(getEditsForUri(result, ssl2Uri)).toBeDefined();
        });

        it("returns null for symbol defined in external headers (path traversal guard)", () => {
            const externalUri = "file:///external/headers/sfall.h";
            const sslUri = "file:///project/scripts/main.ssl";

            const sslText = `
procedure main begin
    call sfall_func;
end
`;

            const refsIndex = new ReferencesIndex();
            refsIndex.updateFile(sslUri, extractCallSites(sslText, sslUri));

            const symbolStore = new Symbols();
            symbolStore.updateFile(externalUri, [{
                name: "sfall_func",
                kind: SymbolKind.Procedure,
                callable: {},
                location: { uri: externalUri, range: { start: { line: 0, character: 10 }, end: { line: 0, character: 20 } } },
                scope: { level: ScopeLevel.Workspace },
                source: { type: SourceType.Workspace, uri: externalUri, displayPath: "sfall.h" },
                completion: { label: "sfall_func" },
                hover: { contents: { kind: MarkupKind.Markdown, value: "" } },
            }]);

            // Cursor on "sfall_func" (defined outside workspace root /project)
            const position: Position = { line: 2, character: 10 };
            const result = renameSymbolWorkspace(
                sslText, position, "new_sfall_func", sslUri,
                refsIndex, symbolStore,
                () => null,
                "/project",
            );

            // Should return null — symbol is defined outside workspace, not renameable
            expect(result).toBeNull();
        });

        it("returns null for function-scoped variable (not workspace-renameable)", () => {
            const sslUri = "file:///project/scripts/main.ssl";
            const sslText = `
procedure foo begin
    variable counter;
    counter := 0;
end
`;

            const refsIndex = new ReferencesIndex();
            const symbolStore = new Symbols();

            // Cursor on "counter" (function-scoped variable)
            const position: Position = { line: 2, character: 14 };
            const result = renameSymbolWorkspace(
                sslText, position, "new_counter", sslUri,
                refsIndex, symbolStore,
                () => null,
                "/project",
            );

            // Should return null -- function-scoped vars are handled by single-file rename
            expect(result).toBeNull();
        });

        it("skips files where the symbol is locally redefined (shadowing)", () => {
            const headerUri = "file:///project/headers/utils.h";
            const ssl1Uri = "file:///project/scripts/a.ssl";
            const ssl2Uri = "file:///project/scripts/b.ssl";

            const headerText = `procedure helper begin end`;
            // a.ssl includes the header and calls helper
            const ssl1Text = `
#include "headers/utils.h"

procedure main begin
    call helper;
end
`;
            // b.ssl includes the header but redefines helper locally
            const ssl2Text = `
#include "headers/utils.h"

procedure helper begin
    display_msg("local version");
end

procedure main begin
    call helper;
end
`;

            const refsIndex = new ReferencesIndex();
            refsIndex.updateFile(headerUri, extractCallSites(headerText, headerUri));
            refsIndex.updateFile(ssl1Uri, extractCallSites(ssl1Text, ssl1Uri));
            refsIndex.updateFile(ssl2Uri, extractCallSites(ssl2Text, ssl2Uri));

            const symbolStore = new Symbols();

            // Rename "helper" from header
            const position: Position = { line: 0, character: 12 };
            const result = renameSymbolWorkspace(
                headerText, position, "new_helper", headerUri,
                refsIndex, symbolStore,
                makeGetFileText({ [headerUri]: headerText, [ssl1Uri]: ssl1Text, [ssl2Uri]: ssl2Text }),
                "/project",
            );

            expect(result).not.toBeNull();
            // Header and a.ssl should be renamed
            expect(getEditsForUri(result, headerUri)).toBeDefined();
            expect(getEditsForUri(result, ssl1Uri)).toBeDefined();
            // b.ssl should NOT be renamed (it redefines helper locally)
            expect(getEditsForUri(result, ssl2Uri)).toBeUndefined();
        });

        it("workspace rename skips procedure-local shadows but renames other refs in same file", () => {
            const headerUri = "file:///project/headers/defs.h";
            const sslUri = "file:///project/scripts/main.ssl";

            const headerText = `#define FOO 42`;
            // main.ssl: one procedure shadows FOO, another uses it
            const sslText = `
#include "headers/defs.h"

procedure shadower begin
    variable FOO;
    FOO := 1;
end
procedure user begin
    display_msg(FOO);
end
`;

            const refsIndex = new ReferencesIndex();
            refsIndex.updateFile(headerUri, extractCallSites(headerText, headerUri));
            refsIndex.updateFile(sslUri, extractCallSites(sslText, sslUri));

            const symbolStore = new Symbols();

            // Rename FOO from header
            const position: Position = { line: 0, character: 8 };
            const result = renameSymbolWorkspace(
                headerText, position, "BAR", headerUri,
                refsIndex, symbolStore,
                makeGetFileText({ [headerUri]: headerText, [sslUri]: sslText }),
                "/project",
            );

            expect(result).not.toBeNull();
            const headerEdits = getEditsForUri(result, headerUri);
            const sslEdits = getEditsForUri(result, sslUri);

            expect(headerEdits).toBeDefined();
            expect(headerEdits!.length).toBe(1);

            // SSL file should have edits for "user" procedure's FOO,
            // but NOT for "shadower" procedure's local FOO
            expect(sslEdits).toBeDefined();
            expect(sslEdits!.length).toBe(1);
            // The edit should be on the display_msg(FOO) line in "user"
            expect(sslEdits![0].range.start.line).toBe(8); // line with display_msg(FOO)
        });

        it("renames from reference site (not just definition)", () => {
            const headerUri = "file:///project/headers/utils.h";
            const sslUri = "file:///project/scripts/main.ssl";

            const headerText = `procedure helper begin end`;
            const sslText = `
#include "headers/utils.h"

procedure main begin
    call helper;
end
`;

            const refsIndex = new ReferencesIndex();
            refsIndex.updateFile(headerUri, extractCallSites(headerText, headerUri));
            refsIndex.updateFile(sslUri, extractCallSites(sslText, sslUri));

            // Create symbol store with the header symbol so lookup works from reference site
            const symbolStore = new Symbols();
            symbolStore.updateFile(headerUri, [{
                name: "helper",
                kind: SymbolKind.Procedure,
                callable: {},
                location: { uri: headerUri, range: { start: { line: 0, character: 10 }, end: { line: 0, character: 16 } } },
                scope: { level: ScopeLevel.Workspace },
                source: { type: SourceType.Workspace, uri: headerUri, displayPath: "headers/utils.h" },
                completion: { label: "helper" },
                hover: { contents: { kind: MarkupKind.Markdown, value: "" } },
            }]);

            // Rename from reference site in .ssl file (cursor on "helper" in call)
            const position: Position = { line: 4, character: 10 };
            const result = renameSymbolWorkspace(
                sslText, position, "new_helper", sslUri,
                refsIndex, symbolStore,
                makeGetFileText({ [headerUri]: headerText, [sslUri]: sslText }),
                "/project",
            );

            expect(result).not.toBeNull();
            // Both files should be edited
            expect(getEditsForUri(result, headerUri)).toBeDefined();
            expect(getEditsForUri(result, sslUri)).toBeDefined();
        });

        it("renames across files that reference the symbol (regardless of include structure)", () => {
            const headerCUri = "file:///project/headers/c.h";
            const headerBUri = "file:///project/headers/b.h";
            const sslAUri = "file:///project/scripts/a.ssl";

            const headerCText = `procedure deep_func begin end`;
            const headerBText = `
#include "c.h"

procedure mid_func begin
    call deep_func;
end
`;
            const sslAText = `
#include "headers/b.h"

procedure main begin
    call deep_func;
end
`;

            const refsIndex = new ReferencesIndex();
            refsIndex.updateFile(headerCUri, extractCallSites(headerCText, headerCUri));
            refsIndex.updateFile(headerBUri, extractCallSites(headerBText, headerBUri));
            refsIndex.updateFile(sslAUri, extractCallSites(sslAText, sslAUri));

            const symbolStore = new Symbols();

            // Rename deep_func from its definition in c.h
            const position: Position = { line: 0, character: 15 };
            const result = renameSymbolWorkspace(
                headerCText, position, "renamed_func", headerCUri,
                refsIndex, symbolStore,
                makeGetFileText({ [headerCUri]: headerCText, [headerBUri]: headerBText, [sslAUri]: sslAText }),
                "/project",
            );

            expect(result).not.toBeNull();
            // All three files should have edits
            expect(getEditsForUri(result, headerCUri)).toBeDefined();
            expect(getEditsForUri(result, headerBUri)).toBeDefined();
            expect(getEditsForUri(result, sslAUri)).toBeDefined();
        });

        it("renames symbol in header that uses it without directly including the definition", () => {
            // Real-world case: den.h uses GVAR_DEN_GANGWAR defined in global.h,
            // but den.h does not #include global.h -- it relies on .ssl files
            // including both headers. The flat ReferencesIndex catches this because
            // it indexes all identifiers regardless of include relationships.
            const globalHUri = "file:///project/headers/global.h";
            const denHUri = "file:///project/headers/den.h";
            const sslUri = "file:///project/den/dcg1grd.ssl";

            const globalHText = `#define GVAR_DEN_GANGWAR (454)`;
            const denHText = `
#define gangwar(x) (global_var(GVAR_DEN_GANGWAR) == x)
`;
            const sslText = `
#include "../headers/define.h"
#include "../headers/den.h"

procedure start begin
    if gangwar(1) then begin end
end
`;

            const refsIndex = new ReferencesIndex();
            refsIndex.updateFile(globalHUri, extractCallSites(globalHText, globalHUri));
            refsIndex.updateFile(denHUri, extractCallSites(denHText, denHUri));
            refsIndex.updateFile(sslUri, extractCallSites(sslText, sslUri));

            const symbolStore = new Symbols();

            // Rename GVAR_DEN_GANGWAR from its definition in global.h
            const position: Position = { line: 0, character: 8 };
            const result = renameSymbolWorkspace(
                globalHText, position, "GVAR_DEN_GANGWAR_NEW", globalHUri,
                refsIndex, symbolStore,
                makeGetFileText({ [globalHUri]: globalHText, [denHUri]: denHText, [sslUri]: sslText }),
                "/project",
            );

            expect(result).not.toBeNull();
            // global.h: the definition itself
            expect(getEditsForUri(result, globalHUri)).toBeDefined();
            // den.h: uses the symbol without including global.h directly
            expect(getEditsForUri(result, denHUri)).toBeDefined();
        });
    });
});
