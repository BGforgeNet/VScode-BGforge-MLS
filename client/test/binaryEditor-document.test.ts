/**
 * Unit tests for ProDocument edit model.
 * Tests field lookup, edit application, undo/redo callbacks, and serialization.
 */

import { vi, describe, expect, it, beforeEach } from "vitest";

// Mock vscode EventEmitter with a minimal implementation
vi.mock("vscode", () => {
    class EventEmitter<T> {
        private listeners: Array<(e: T) => void> = [];
        event = (listener: (e: T) => void) => {
            this.listeners.push(listener);
            return { dispose: () => { this.listeners = this.listeners.filter(l => l !== listener); } };
        };
        fire(data: T) { for (const l of this.listeners) l(data); }
        dispose() { this.listeners = []; }
    }
    return { EventEmitter, Uri: { file: (p: string) => ({ fsPath: p, scheme: "file", toString: () => p }) } };
});

import { ProDocument } from "../src/editors/binaryEditor-document";
import type { ParseResult } from "../src/parsers/types";

function makeTestResult(): ParseResult {
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
                        { name: "Object ID", value: 1, offset: 1, size: 3, type: "uint24" },
                        { name: "Text ID", value: 100, offset: 4, size: 4, type: "uint32" },
                        { name: "Flags", value: "LightThru", offset: 20, size: 4, type: "flags", rawValue: 536870912 },
                    ],
                },
                {
                    name: "Misc Properties",
                    expanded: true,
                    fields: [
                        { name: "Unknown", value: 0, offset: 24, size: 4, type: "uint32" },
                    ],
                },
            ],
        },
    };
}

// Provide vscode.Uri for the document constructor
const fakeUri = { fsPath: "/test/file.pro", scheme: "file", toString: () => "/test/file.pro" } as any;

describe("ProDocument", () => {
    let doc: ProDocument;

    beforeEach(() => {
        doc = new ProDocument(fakeUri, makeTestResult());
    });

    it("exposes the parse result", () => {
        expect(doc.parseResult.format).toBe("pro");
        expect(doc.parseResult.root.name).toBe("PRO File");
    });

    describe("applyEdit", () => {
        it("edits a numeric field by path", () => {
            const edit = doc.applyEdit("Header.Text ID", 200, "200");
            expect(edit).toBeDefined();
            expect(edit!.oldRawValue).toBe(100);
            expect(edit!.newRawValue).toBe(200);

            // Verify the field was updated
            const header = doc.parseResult.root.fields[0] as any;
            const textId = header.fields.find((f: any) => f.name === "Text ID");
            expect(textId.value).toBe("200");
            expect(textId.rawValue).toBe(200);
        });

        it("edits an enum field preserving rawValue", () => {
            const edit = doc.applyEdit("Header.Object Type", 1, "Critter");
            expect(edit).toBeDefined();
            expect(edit!.oldRawValue).toBe(5);

            const header = doc.parseResult.root.fields[0] as any;
            const objType = header.fields.find((f: any) => f.name === "Object Type");
            expect(objType.value).toBe("Critter");
            expect(objType.rawValue).toBe(1);
        });

        it("returns undefined for nonexistent field", () => {
            const edit = doc.applyEdit("Header.Nonexistent", 42, "42");
            expect(edit).toBeUndefined();
        });

        it("fires onDidChange event with document, label, undo, and redo", () => {
            const events: any[] = [];
            doc.onDidChange((e) => events.push(e));

            doc.applyEdit("Header.Text ID", 200, "200");
            expect(events).toHaveLength(1);
            expect(events[0].document).toBe(doc);
            expect(events[0].label).toBe("Edit Header.Text ID");
            expect(typeof events[0].undo).toBe("function");
            expect(typeof events[0].redo).toBe("function");
        });

        it("fires onDidChangeContent event", () => {
            let fired = false;
            doc.onDidChangeContent(() => { fired = true; });

            doc.applyEdit("Header.Text ID", 200, "200");
            expect(fired).toBe(true);
        });
    });

    describe("undo/redo", () => {
        it("undo restores the previous value", () => {
            const events: any[] = [];
            doc.onDidChange((e) => events.push(e));

            doc.applyEdit("Header.Text ID", 200, "200");
            events[0].undo();

            const header = doc.parseResult.root.fields[0] as any;
            const textId = header.fields.find((f: any) => f.name === "Text ID");
            expect(textId.value).toBe("100");
        });

        it("redo reapplies the edit", () => {
            const events: any[] = [];
            doc.onDidChange((e) => events.push(e));

            doc.applyEdit("Header.Text ID", 200, "200");
            events[0].undo();
            events[0].redo();

            const header = doc.parseResult.root.fields[0] as any;
            const textId = header.fields.find((f: any) => f.name === "Text ID");
            expect(textId.value).toBe("200");
            expect(textId.rawValue).toBe(200);
        });
    });

    describe("reset", () => {
        it("replaces the parse result and fires content change", () => {
            let fired = false;
            doc.onDidChangeContent(() => { fired = true; });

            const newResult = makeTestResult();
            (newResult.root.fields[0] as any).fields[2].value = 999;
            doc.reset(newResult);

            expect(doc.parseResult).toBe(newResult);
            expect(fired).toBe(true);
        });
    });

    describe("getContent", () => {
        it("returns a Uint8Array", () => {
            const content = doc.getContent();
            expect(content).toBeInstanceOf(Uint8Array);
            expect(content.length).toBeGreaterThan(0);
        });
    });

    describe("dispose", () => {
        it("does not throw", () => {
            expect(() => doc.dispose()).not.toThrow();
        });
    });
});
