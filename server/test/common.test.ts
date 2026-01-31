/**
 * Unit tests for common.ts utility functions.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

const mockSendDiagnostics = vi.fn();

// Mock lsp-connection to provide a controllable connection
vi.mock("../src/lsp-connection", () => ({
    getConnection: () => ({
        console: { log: vi.fn() },
        sendDiagnostics: mockSendDiagnostics,
    }),
}));

import { symbolAtPosition, sendParseResult, isSubpath, expandHome, type ParseResult } from "../src/common";

describe("symbolAtPosition", () => {
    it("returns word under cursor", () => {
        const text = "hello world";
        const result = symbolAtPosition(text, { line: 0, character: 6 });
        expect(result).toBe("world");
    });

    it("returns word at start of line", () => {
        const text = "hello world";
        const result = symbolAtPosition(text, { line: 0, character: 0 });
        expect(result).toBe("hello");
    });

    it("returns word at end of line", () => {
        const text = "hello world";
        const result = symbolAtPosition(text, { line: 0, character: 10 });
        expect(result).toBe("world");
    });

    it("handles multiline text", () => {
        const text = "first line\nsecond line";
        const result = symbolAtPosition(text, { line: 1, character: 7 });
        expect(result).toBe("line");
    });

    it("returns empty string for empty line", () => {
        const text = "";
        const result = symbolAtPosition(text, { line: 0, character: 0 });
        expect(result).toBe("");
    });

    it("returns empty string for out of bounds line", () => {
        const text = "hello";
        const result = symbolAtPosition(text, { line: 5, character: 0 });
        expect(result).toBe("");
    });

    it("handles function call syntax", () => {
        const text = "NOption(154,Node003,004";
        const result = symbolAtPosition(text, { line: 0, character: 3 });
        expect(result).toBe("NOption");
    });

    it("returns tra reference for pure numeric in context", () => {
        const text = "NOption(154,Node003,004";
        const result = symbolAtPosition(text, { line: 0, character: 9 });
        expect(result).toBe("NOption(154");
    });

    it("returns 'tra' when cursor on $tra (not the number)", () => {
        const text = "const x = $tra(100);";
        // Position 12 is on 'r' in 'tra'
        const result = symbolAtPosition(text, { line: 0, character: 12 });
        expect(result).toBe("tra");
    });

    it("returns full $tra(123) when cursor on number", () => {
        const text = "const x = $tra(100);";
        // Position 15-17 is on the digits
        const result = symbolAtPosition(text, { line: 0, character: 16 });
        expect(result).toBe("$tra(100)");
    });
});

describe("sendParseResult", () => {
    beforeEach(() => {
        mockSendDiagnostics.mockClear();
    });

    it("sends multiple errors for the same URI", () => {
        const parseResult: ParseResult = {
            errors: [
                { uri: "file:///a.tp2", line: 1, columnStart: 0, columnEnd: 10, message: "error 1" },
                { uri: "file:///a.tp2", line: 5, columnStart: 0, columnEnd: 20, message: "error 2" },
            ],
            warnings: [],
        };
        sendParseResult(parseResult, "file:///a.tp2", "file:///tmp.tp2");

        expect(mockSendDiagnostics).toHaveBeenCalledTimes(1);
        const call = mockSendDiagnostics.mock.calls[0]![0];
        expect(call.uri).toBe("file:///a.tp2");
        expect(call.diagnostics).toHaveLength(2);
    });

    it("replaces tmpUri with mainUri for errors", () => {
        const parseResult: ParseResult = {
            errors: [
                { uri: "file:///tmp.tp2", line: 3, columnStart: 0, columnEnd: 5, message: "err" },
            ],
            warnings: [],
        };
        sendParseResult(parseResult, "file:///main.tp2", "file:///tmp.tp2");

        const call = mockSendDiagnostics.mock.calls[0]![0];
        expect(call.uri).toBe("file:///main.tp2");
    });

    it("replaces tmpUri with mainUri for warnings", () => {
        const parseResult: ParseResult = {
            errors: [],
            warnings: [
                { uri: "file:///tmp.tp2", line: 3, columnStart: 0, columnEnd: 5, message: "warn" },
            ],
        };
        sendParseResult(parseResult, "file:///main.tp2", "file:///tmp.tp2");

        const call = mockSendDiagnostics.mock.calls[0]![0];
        expect(call.uri).toBe("file:///main.tp2");
    });

    it("accumulates errors and warnings for the same URI", () => {
        const parseResult: ParseResult = {
            errors: [
                { uri: "file:///a.tp2", line: 1, columnStart: 0, columnEnd: 10, message: "error" },
            ],
            warnings: [
                { uri: "file:///a.tp2", line: 2, columnStart: 0, columnEnd: 10, message: "warning" },
            ],
        };
        sendParseResult(parseResult, "file:///a.tp2", "file:///tmp.tp2");

        expect(mockSendDiagnostics).toHaveBeenCalledTimes(1);
        const call = mockSendDiagnostics.mock.calls[0]![0];
        expect(call.diagnostics).toHaveLength(2);
    });

    it("groups diagnostics by URI across multiple files", () => {
        const parseResult: ParseResult = {
            errors: [
                { uri: "file:///a.tp2", line: 1, columnStart: 0, columnEnd: 10, message: "err a" },
                { uri: "file:///b.h", line: 2, columnStart: 0, columnEnd: 5, message: "err b" },
            ],
            warnings: [],
        };
        sendParseResult(parseResult, "file:///a.tp2", "file:///tmp.tp2");

        expect(mockSendDiagnostics).toHaveBeenCalledTimes(2);
    });
});

describe("isSubpath", () => {
    it("returns false for undefined outerPath", () => {
        expect(isSubpath(undefined, "/some/path")).toBe(false);
    });

    it("returns false for non-existent paths", () => {
        expect(isSubpath("/nonexistent/path", "/also/nonexistent")).toBe(false);
    });
});

describe("expandHome", () => {
    it("expands ~/path to home directory", () => {
        const result = expandHome("~/bin/sslc");
        expect(result).not.toContain("~");
        expect(result).toMatch(/\/bin\/sslc$/);
    });

    it("expands bare ~ to home directory", () => {
        const result = expandHome("~");
        expect(result).not.toBe("~");
        expect(result.length).toBeGreaterThan(1);
    });

    it("does not expand ~user syntax", () => {
        expect(expandHome("~otheruser/bin")).toBe("~otheruser/bin");
    });

    it("returns absolute paths unchanged", () => {
        expect(expandHome("/usr/bin/sslc")).toBe("/usr/bin/sslc");
    });

    it("returns relative paths unchanged", () => {
        expect(expandHome("bin/sslc")).toBe("bin/sslc");
    });
});
