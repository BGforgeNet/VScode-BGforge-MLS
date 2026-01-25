/**
 * Tests for shared/signature.ts - signature help utilities.
 */

import { describe, expect, it, vi } from "vitest";
import { getResponse, getRequest } from "../../src/shared/signature";

// Mock static-data loader (not needed for these tests)
vi.mock("../../src/shared/static-data", () => ({
    loadStaticMap: vi.fn(() => new Map()),
}));

describe("shared/signature", () => {
    describe("getResponse()", () => {
        it("should create a SignatureHelp response", () => {
            const signature = { label: "myFunc(a: number, b: string)" };
            const result = getResponse(signature, 0);

            expect(result).toEqual({
                signatures: [signature],
                activeSignature: 0,
                activeParameter: 0,
            });
        });

        it("should set the correct active parameter", () => {
            const signature = { label: "myFunc(a, b, c)" };
            const result = getResponse(signature, 2);

            expect(result.activeParameter).toBe(2);
        });

        it("should always set activeSignature to 0", () => {
            const signature = { label: "test()" };
            const result = getResponse(signature, 5);

            expect(result.activeSignature).toBe(0);
        });
    });

    describe("getRequest()", () => {
        it("should parse a simple function call", () => {
            const text = "myFunc(";
            const position = { line: 0, character: 7 };

            const result = getRequest(text, position);

            expect(result).toEqual({
                symbol: "myFunc",
                parameter: 0,
            });
        });

        it("should detect the first parameter position", () => {
            const text = "myFunc(arg1";
            const position = { line: 0, character: 11 };

            const result = getRequest(text, position);

            expect(result).toEqual({
                symbol: "myFunc",
                parameter: 0,
            });
        });

        it("should detect the second parameter position after comma", () => {
            const text = "myFunc(arg1, arg2";
            const position = { line: 0, character: 17 };

            const result = getRequest(text, position);

            expect(result).toEqual({
                symbol: "myFunc",
                parameter: 1,
            });
        });

        it("should detect the third parameter position", () => {
            const text = "myFunc(arg1, arg2, arg3";
            const position = { line: 0, character: 23 };

            const result = getRequest(text, position);

            expect(result).toEqual({
                symbol: "myFunc",
                parameter: 2,
            });
        });

        it("should handle function calls after whitespace", () => {
            const text = "call myFunc(arg";
            const position = { line: 0, character: 15 };

            const result = getRequest(text, position);

            expect(result).toEqual({
                symbol: "myFunc",
                parameter: 0,
            });
        });

        it("should return undefined when on closing parenthesis", () => {
            const text = "myFunc(arg)";
            const position = { line: 0, character: 11 };

            const result = getRequest(text, position);

            expect(result).toBeUndefined();
        });

        it("should return undefined for invalid line", () => {
            const text = "line1\nline2";
            const position = { line: 5, character: 0 };

            const result = getRequest(text, position);

            expect(result).toBeUndefined();
        });

        it("should return undefined when no opening parenthesis found", () => {
            const text = "no parenthesis here";
            const position = { line: 0, character: 10 };

            const result = getRequest(text, position);

            expect(result).toBeUndefined();
        });

        it("should handle multiline text", () => {
            const text = "line1\nmyFunc(arg1, arg2\nline3";
            const position = { line: 1, character: 22 };

            const result = getRequest(text, position);

            expect(result).toEqual({
                symbol: "myFunc",
                parameter: 1,
            });
        });

        it("should handle nested function calls (gets innermost)", () => {
            const text = "outer(inner(";
            const position = { line: 0, character: 12 };

            const result = getRequest(text, position);

            expect(result).toEqual({
                symbol: "inner",
                parameter: 0,
            });
        });

        it("should handle cursor at comma position", () => {
            const text = "myFunc(arg1,";
            const position = { line: 0, character: 12 };

            const result = getRequest(text, position);

            expect(result).toEqual({
                symbol: "myFunc",
                parameter: 1,
            });
        });

        it("should handle empty argument list", () => {
            const text = "myFunc(";
            const position = { line: 0, character: 7 };

            const result = getRequest(text, position);

            expect(result).toEqual({
                symbol: "myFunc",
                parameter: 0,
            });
        });

        it("should handle Windows line endings", () => {
            const text = "line1\r\nmyFunc(\r\n";
            const position = { line: 1, character: 7 };

            const result = getRequest(text, position);

            expect(result).toEqual({
                symbol: "myFunc",
                parameter: 0,
            });
        });
    });
});
