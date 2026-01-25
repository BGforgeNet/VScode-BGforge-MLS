/**
 * Tests for shared/format-utils.ts - formatting utilities.
 */

import { describe, expect, it } from "vitest";
import {
    createFullDocumentEdit,
    stripCommentsWeidu,
    stripCommentsFalloutSsl,
    validateFormatting,
} from "../../src/shared/format-utils";

describe("shared/format-utils", () => {
    describe("createFullDocumentEdit()", () => {
        it("should create a single edit replacing entire document", () => {
            const original = "line1\nline2\nline3";
            const newText = "new content";

            const edits = createFullDocumentEdit(original, newText);

            expect(edits).toHaveLength(1);
            expect(edits[0].newText).toBe(newText);
        });

        it("should set correct range for single line", () => {
            const original = "single line";
            const newText = "replaced";

            const edits = createFullDocumentEdit(original, newText);

            expect(edits[0].range.start).toEqual({ line: 0, character: 0 });
            expect(edits[0].range.end).toEqual({ line: 0, character: 11 });
        });

        it("should set correct range for multiple lines", () => {
            const original = "line1\nline2\nline3";
            const newText = "replaced";

            const edits = createFullDocumentEdit(original, newText);

            expect(edits[0].range.start).toEqual({ line: 0, character: 0 });
            expect(edits[0].range.end).toEqual({ line: 2, character: 5 });
        });

        it("should handle empty last line", () => {
            const original = "line1\nline2\n";
            const newText = "replaced";

            const edits = createFullDocumentEdit(original, newText);

            expect(edits[0].range.end).toEqual({ line: 2, character: 0 });
        });

        it("should handle empty document", () => {
            const original = "";
            const newText = "new content";

            const edits = createFullDocumentEdit(original, newText);

            expect(edits[0].range.start).toEqual({ line: 0, character: 0 });
            expect(edits[0].range.end).toEqual({ line: 0, character: 0 });
        });
    });

    describe("stripCommentsWeidu()", () => {
        it("should remove line comments", () => {
            const input = "code // comment\nmore";
            const result = stripCommentsWeidu(input);

            expect(result).toBe("code \nmore");
        });

        it("should remove block comments", () => {
            const input = "code /* block comment */ more";
            const result = stripCommentsWeidu(input);

            expect(result).toBe("code  more");
        });

        it("should remove multiline block comments", () => {
            const input = "code /* line1\nline2\nline3 */ more";
            const result = stripCommentsWeidu(input);

            expect(result).toBe("code  more");
        });

        it("should preserve tilde strings", () => {
            const input = "~string with // comment~";
            const result = stripCommentsWeidu(input);

            expect(result).toBe("~string with // comment~");
        });

        it("should preserve double-quoted strings", () => {
            const input = '"string with // comment"';
            const result = stripCommentsWeidu(input);

            expect(result).toBe('"string with // comment"');
        });

        it("should handle escaped characters in strings", () => {
            const input = '"string with \\" quote"';
            const result = stripCommentsWeidu(input);

            expect(result).toBe('"string with \\" quote"');
        });

        it("should handle five-tilde strings", () => {
            const input = "~~~~~string with ~ tilde~~~~~";
            const result = stripCommentsWeidu(input);

            expect(result).toBe("~~~~~string with ~ tilde~~~~~");
        });

        it("should handle unclosed block comments", () => {
            const input = "code /* unclosed";
            const result = stripCommentsWeidu(input);

            expect(result).toBe("code ");
        });

        it("should preserve normal content", () => {
            const input = "ACTION IF_EXISTS";
            const result = stripCommentsWeidu(input);

            expect(result).toBe("ACTION IF_EXISTS");
        });
    });

    describe("stripCommentsFalloutSsl()", () => {
        it("should remove line comments", () => {
            const input = "code // comment\nmore";
            const result = stripCommentsFalloutSsl(input);

            expect(result).toBe("code \nmore");
        });

        it("should remove block comments", () => {
            const input = "code /* block comment */ more";
            const result = stripCommentsFalloutSsl(input);

            expect(result).toBe("code  more");
        });

        it("should preserve double-quoted strings", () => {
            const input = '"string with // comment"';
            const result = stripCommentsFalloutSsl(input);

            expect(result).toBe('"string with // comment"');
        });

        it("should handle escaped characters in strings", () => {
            const input = '"string with \\" quote"';
            const result = stripCommentsFalloutSsl(input);

            expect(result).toBe('"string with \\" quote"');
        });

        it("should handle unclosed block comments", () => {
            const input = "code /* unclosed";
            const result = stripCommentsFalloutSsl(input);

            expect(result).toBe("code ");
        });

        it("should preserve normal content", () => {
            const input = "procedure my_proc begin end";
            const result = stripCommentsFalloutSsl(input);

            expect(result).toBe("procedure my_proc begin end");
        });
    });

    describe("validateFormatting()", () => {
        it("should return null when content is unchanged", () => {
            const original = "code()";
            const formatted = "  code()  ";

            const result = validateFormatting(original, formatted, stripCommentsFalloutSsl);

            expect(result).toBeNull();
        });

        it("should return null when only whitespace changed", () => {
            const original = "func(a,b)";
            const formatted = "func( a , b )";

            const result = validateFormatting(original, formatted, stripCommentsFalloutSsl);

            expect(result).toBeNull();
        });

        it("should return error when content changed", () => {
            const original = "func(a)";
            const formatted = "func(b)";

            const result = validateFormatting(original, formatted, stripCommentsFalloutSsl);

            expect(result).not.toBeNull();
            expect(result).toContain("Formatter changed content");
        });

        it("should return error with context when content changed", () => {
            const original = "something original here";
            const formatted = "something modified here";

            const result = validateFormatting(original, formatted, stripCommentsFalloutSsl);

            expect(result).toContain("position");
        });

        it("should ignore comments when validating", () => {
            const original = "code() // comment";
            const formatted = "code()";

            const result = validateFormatting(original, formatted, stripCommentsFalloutSsl);

            expect(result).toBeNull();
        });

        it("should detect added characters", () => {
            const original = "abc";
            const formatted = "abcd";

            const result = validateFormatting(original, formatted, stripCommentsFalloutSsl);

            expect(result).not.toBeNull();
        });

        it("should detect removed characters", () => {
            const original = "abcd";
            const formatted = "abc";

            const result = validateFormatting(original, formatted, stripCommentsFalloutSsl);

            expect(result).not.toBeNull();
        });

        it("should work with WeiDU comment stripper", () => {
            const original = "ACTION /* comment */";
            const formatted = "ACTION";

            const result = validateFormatting(original, formatted, stripCommentsWeidu);

            expect(result).toBeNull();
        });
    });
});
