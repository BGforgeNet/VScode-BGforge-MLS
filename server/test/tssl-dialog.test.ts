/**
 * Unit tests for tssl/dialog.ts - TSSL dialog parser for tree visualization.
 * Mocks the TSSL transpiler and tests that parseTSSLDialog correctly
 * routes transpiled SSL through the existing SSL dialog parser.
 */

import { describe, expect, it, beforeAll, vi } from "vitest";

// Mock lsp-connection to avoid LSP connection issues in tests
vi.mock("../src/lsp-connection", () => ({
    getConnection: () => ({
        console: { log: vi.fn() },
        sendDiagnostics: vi.fn(),
    }),
}));

// Mock the TSSL transpiler — it requires esbuild, ts-morph, and file I/O.
// We return pre-built SSL text so the test focuses on the dialog parsing pipeline.
vi.mock("../../transpilers/tssl/src/index", () => ({
    transpile: vi.fn(),
}));

import { parseTSSLDialog } from "../src/tssl/dialog";
import { initParser } from "../src/fallout-ssl/parser";
import { transpile } from "../../transpilers/tssl/src/index";

const mockedTranspile = vi.mocked(transpile);

beforeAll(async () => {
    await initParser();
});

describe("tssl/dialog", () => {
    describe("parseTSSLDialog()", () => {
        it("returns empty data when parser not initialized", async () => {
            const mod = await import("../src/fallout-ssl/parser");
            const spy = vi.spyOn(mod, "isInitialized").mockReturnValueOnce(false);

            const result = await parseTSSLDialog("file:///test.tssl", "// anything");

            expect(result).toEqual({ nodes: [], entryPoints: [] });
            spy.mockRestore();
        });

        it("parses a simple TSSL dialog with Reply and NOption", async () => {
            // SSL output that the transpiler would produce from a simple TSSL dialog
            const sslText = `
procedure Node001 begin
    Reply(100);
    NOption(101, Node002, 4);
end

procedure Node002 begin
    Reply(200);
    NMessage(201);
end

procedure talk_p_proc begin
    call Node001;
end
`;
            mockedTranspile.mockResolvedValueOnce(sslText);

            const result = await parseTSSLDialog("file:///test.tssl", "// tssl source");

            expect(result.entryPoints).toContain("Node001");
            expect(result.nodes).toHaveLength(2);

            const node1 = result.nodes.find(n => n.name === "Node001");
            expect(node1).toBeDefined();
            expect(node1!.replies).toHaveLength(1);
            expect(node1!.replies[0]!.msgId).toBe(100);
            expect(node1!.options).toHaveLength(1);
            expect(node1!.options[0]!.target).toBe("Node002");

            const node2 = result.nodes.find(n => n.name === "Node002");
            expect(node2).toBeDefined();
            expect(node2!.replies).toHaveLength(1);
            expect(node2!.options).toHaveLength(1);
            expect(node2!.options[0]!.type).toBe("NMessage");
        });

        it("parses talk_p_proc entry points from transpiled output", async () => {
            const sslText = `
procedure NodeA begin
    Reply(10);
    NMessage(11);
end

procedure NodeB begin
    Reply(20);
    NMessage(21);
end

procedure talk_p_proc begin
    if (local_var(0)) then
        call NodeA;
    else
        call NodeB;
    end
end
`;
            mockedTranspile.mockResolvedValueOnce(sslText);

            const result = await parseTSSLDialog("file:///dialog.tssl", "// tssl source");

            expect(result.entryPoints).toContain("NodeA");
            expect(result.entryPoints).toContain("NodeB");
            expect(result.nodes).toHaveLength(2);
        });

        it("passes file path and text to transpile()", async () => {
            const sslText = `procedure talk_p_proc begin end`;
            mockedTranspile.mockResolvedValueOnce(sslText);

            await parseTSSLDialog("file:///path/to/script.tssl", "const x = 1;");

            expect(mockedTranspile).toHaveBeenCalledWith(
                "/path/to/script.tssl",
                "const x = 1;",
            );
        });
    });
});
