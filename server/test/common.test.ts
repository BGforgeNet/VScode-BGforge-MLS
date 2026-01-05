/**
 * Unit tests for common.ts utility functions.
 */

import { describe, expect, it, vi } from "vitest";

// Mock the server module to avoid LSP connection issues
vi.mock("../src/server", () => ({
    connection: {
        console: { log: vi.fn() },
        sendDiagnostics: vi.fn(),
    },
}));

import { symbolAtPosition } from "../src/common";

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
