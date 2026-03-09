/**
 * Unit tests for core/normalized-uri.ts -- URI normalization with branded type.
 */

import { describe, expect, it } from "vitest";
import { normalizeUri, type NormalizedUri } from "../../src/core/normalized-uri";

describe("core/normalized-uri", () => {
    describe("normalizeUri", () => {
        it("passes through simple file URIs unchanged", () => {
            const uri = "file:///home/user/project/file.h";
            expect(normalizeUri(uri)).toBe(uri);
        });

        it("decodes unnecessarily encoded characters (!)", () => {
            // VSCode may encode ! as %21, but pathToFileURL leaves it unencoded
            const encoded = "file:///home/user/%21project/file.h";
            const expected = "file:///home/user/!project/file.h";
            expect(normalizeUri(encoded)).toBe(expected);
        });

        it("is idempotent -- normalizing twice gives the same result", () => {
            const uri = "file:///home/user/%21project/file.h";
            const once = normalizeUri(uri);
            const twice = normalizeUri(once);
            expect(twice).toBe(once);
        });

        it("normalizes two differently-encoded URIs for the same file to the same string", () => {
            // Simulates VSCode-encoded vs pathToFileURL-produced URIs
            const fromVscode = "file:///home/user/%21ecco.git/file.h";
            const fromNode = "file:///home/user/!ecco.git/file.h";
            expect(normalizeUri(fromVscode)).toBe(normalizeUri(fromNode));
        });

        it("passes through non-file URIs unchanged", () => {
            const untitled = "untitled:Untitled-1";
            expect(normalizeUri(untitled)).toBe(untitled);
        });

        it("handles URIs with spaces (encoded as %20)", () => {
            const uri = "file:///home/user/my%20project/file.h";
            const result = normalizeUri(uri);
            // pathToFileURL re-encodes spaces as %20
            expect(result).toContain("%20");
            // Round-trip should preserve the path
            expect(normalizeUri(result)).toBe(result);
        });

        it("handles URIs with special characters that should remain encoded", () => {
            // # must be encoded in URIs
            const uri = "file:///home/user/project%23v2/file.h";
            const result = normalizeUri(uri);
            expect(normalizeUri(result)).toBe(result);
        });

        it("normalizes colon encoding (%3A vs :) to the same result", () => {
            // On Windows, VSCode may encode the drive colon as %3A
            const withPercent = "file:///c%3A/Games/file.h";
            const withColon = "file:///c:/Games/file.h";
            expect(normalizeUri(withPercent)).toBe(normalizeUri(withColon));
        });
    });

    describe("type safety", () => {
        it("returned value is assignable to NormalizedUri", () => {
            const normalized: NormalizedUri = normalizeUri("file:///test.h");
            // If this compiles, the type is correct
            expect(typeof normalized).toBe("string");
        });
    });
});
