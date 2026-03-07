/**
 * Unit tests for core/include-resolver.ts -- include path resolution.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { stripIncludeDelimiters } from "../../src/core/include-resolver";

// Mock fs.existsSync to avoid needing real files
vi.mock("node:fs", () => ({
    existsSync: vi.fn(),
}));

import { existsSync } from "node:fs";
import { resolveIncludePath, type ResolveContext } from "../../src/core/include-resolver";

const mockedExistsSync = vi.mocked(existsSync);

describe("core/include-resolver", () => {
    beforeEach(() => {
        mockedExistsSync.mockReset();
    });

    describe("stripIncludeDelimiters", () => {
        it("strips double quotes", () => {
            expect(stripIncludeDelimiters('"file.h"')).toBe("file.h");
        });

        it("strips angle brackets", () => {
            expect(stripIncludeDelimiters("<file.h>")).toBe("file.h");
        });

        it("returns bare path unchanged", () => {
            expect(stripIncludeDelimiters("file.h")).toBe("file.h");
        });

        it("handles paths with subdirectories", () => {
            expect(stripIncludeDelimiters('"../headers/common.h"')).toBe("../headers/common.h");
        });

        it("trims whitespace before checking delimiters", () => {
            expect(stripIncludeDelimiters(' "file.h" ')).toBe("file.h");
        });
    });

    describe("resolveIncludePath", () => {
        it("resolves relative to including file directory", () => {
            mockedExistsSync.mockImplementation((p) =>
                (p as string).endsWith("/src/file.h")
            );

            const context: ResolveContext = {
                includingFilePath: "/project/src/main.ssl",
            };

            const result = resolveIncludePath('"file.h"', context);
            expect(result).toBe("file:///project/src/file.h");
        });

        it("falls back to workspace root", () => {
            mockedExistsSync.mockImplementation((p) =>
                (p as string) === "/project/headers/defs.h"
            );

            const context: ResolveContext = {
                includingFilePath: "/project/src/main.ssl",
                workspaceRoot: "/project",
            };

            const result = resolveIncludePath('"headers/defs.h"', context);
            expect(result).toBe("file:///project/headers/defs.h");
        });

        it("falls back to search paths", () => {
            mockedExistsSync.mockImplementation((p) =>
                (p as string) === "/external/headers/sfall.h"
            );

            const context: ResolveContext = {
                includingFilePath: "/project/src/main.ssl",
                workspaceRoot: "/project",
                searchPaths: ["/external/headers"],
            };

            const result = resolveIncludePath('"sfall.h"', context);
            expect(result).toBe("file:///external/headers/sfall.h");
        });

        it("returns null for unresolvable path", () => {
            mockedExistsSync.mockReturnValue(false);

            const context: ResolveContext = {
                includingFilePath: "/project/src/main.ssl",
                workspaceRoot: "/project",
            };

            const result = resolveIncludePath('"missing.h"', context);
            expect(result).toBeNull();
        });

        it("returns null for empty path", () => {
            const context: ResolveContext = {
                includingFilePath: "/project/src/main.ssl",
            };

            expect(resolveIncludePath('""', context)).toBeNull();
        });

        it("strips angle delimiters before resolving", () => {
            mockedExistsSync.mockImplementation((p) =>
                (p as string).endsWith("/src/stdlib.h")
            );

            const context: ResolveContext = {
                includingFilePath: "/project/src/main.ssl",
            };

            const result = resolveIncludePath("<stdlib.h>", context);
            expect(result).toBe("file:///project/src/stdlib.h");
        });

        it("handles paths with parent directory traversal", () => {
            mockedExistsSync.mockImplementation((p) =>
                (p as string) === "/project/src/headers/common.h"
            );

            const context: ResolveContext = {
                includingFilePath: "/project/src/scripts/main.ssl",
            };

            const result = resolveIncludePath('"../headers/common.h"', context);
            expect(result).toBe("file:///project/src/headers/common.h");
        });

        it("skips empty search paths", () => {
            mockedExistsSync.mockReturnValue(false);

            const context: ResolveContext = {
                includingFilePath: "/project/src/main.ssl",
                searchPaths: ["", undefined as unknown as string],
            };

            // Should not throw
            const result = resolveIncludePath('"file.h"', context);
            expect(result).toBeNull();
        });

        it("rejects path traversal escaping the including file's directory", () => {
            // Even if the file exists, a path that escapes the workspace should be rejected
            mockedExistsSync.mockReturnValue(true);

            const context: ResolveContext = {
                includingFilePath: "/project/src/main.ssl",
                workspaceRoot: "/project",
            };

            const result = resolveIncludePath('"../../../../etc/passwd"', context);
            expect(result).toBeNull();
        });

        it("rejects absolute paths in includes", () => {
            mockedExistsSync.mockReturnValue(true);

            const context: ResolveContext = {
                includingFilePath: "/project/src/main.ssl",
                workspaceRoot: "/project",
            };

            const result = resolveIncludePath('"/etc/passwd"', context);
            expect(result).toBeNull();
        });

        it("allows paths that stay within workspace via parent traversal", () => {
            // ../../headers/common.h from /project/src/scripts/ resolves to /project/headers/common.h
            // which is inside workspace /project -- should be allowed
            mockedExistsSync.mockImplementation((p) =>
                (p as string) === "/project/headers/common.h"
            );

            const context: ResolveContext = {
                includingFilePath: "/project/src/scripts/main.ssl",
                workspaceRoot: "/project",
            };

            const result = resolveIncludePath('"../../headers/common.h"', context);
            expect(result).toBe("file:///project/headers/common.h");
        });

        it("rejects paths escaping search paths", () => {
            mockedExistsSync.mockReturnValue(true);

            const context: ResolveContext = {
                includingFilePath: "/project/src/main.ssl",
                workspaceRoot: "/project",
                searchPaths: ["/external/headers"],
            };

            const result = resolveIncludePath('"../../etc/passwd"', context);
            expect(result).toBeNull();
        });
    });
});
