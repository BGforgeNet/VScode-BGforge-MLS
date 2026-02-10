/**
 * Unit tests for compile.ts - compilation dispatcher.
 * Tests routing of compile requests to appropriate providers/transpilers.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

const mockShowInfo = vi.fn();
const mockShowError = vi.fn();
const mockShowWarning = vi.fn();
const mockSendDiagnostics = vi.fn();

vi.mock("../src/lsp-connection", () => ({
    getConnection: () => ({
        console: { log: vi.fn() },
        sendDiagnostics: mockSendDiagnostics,
        window: {
            showInformationMessage: mockShowInfo,
            showWarningMessage: mockShowWarning,
            showErrorMessage: mockShowError,
        },
    }),
}));

const mockRegistryCompile = vi.fn();
const mockRegistryHas = vi.fn();

vi.mock("../src/provider-registry", () => ({
    registry: {
        has: (...args: unknown[]) => mockRegistryHas(...args),
        compile: (...args: unknown[]) => mockRegistryCompile(...args),
    },
}));

vi.mock("../src/server", () => ({
    getDocumentSettings: vi.fn().mockResolvedValue({
        falloutSSL: {
            compilePath: "compile",
            useBuiltInCompiler: false,
            compileOptions: "",
            outputDirectory: "",
            headersDirectory: "",
        },
        weidu: {
            path: "weidu",
            gamePath: "/games/bg2",
        },
        validateOnSave: true,
        validateOnChange: false,
    }),
}));

const mockWeiduCompile = vi.fn();
vi.mock("../src/weidu-compile", () => ({
    compile: (...args: unknown[]) => mockWeiduCompile(...args),
}));

const mockTbafCompile = vi.fn();
vi.mock("../src/tbaf/index", () => ({
    compile: (...args: unknown[]) => mockTbafCompile(...args),
}));

const mockTdCompile = vi.fn();
vi.mock("../src/td/index", () => ({
    compile: (...args: unknown[]) => mockTdCompile(...args),
}));

const mockTsslCompile = vi.fn();
vi.mock("../src/tssl", () => ({
    compile: (...args: unknown[]) => mockTsslCompile(...args),
}));

vi.mock("fs", () => ({
    mkdirSync: vi.fn(),
    readFileSync: vi.fn().mockReturnValue("file content"),
}));

vi.mock("../src/common", () => ({
    conlog: vi.fn(),
    isDirectory: vi.fn().mockReturnValue(true),
    pathToUri: vi.fn((p: string) => `file://${p}`),
    tmpDir: "/tmp/bgforge-mls",
}));

import { compile, clearDiagnostics } from "../src/compile";

describe("compile dispatcher", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRegistryHas.mockReturnValue(false);
        mockRegistryCompile.mockResolvedValue(false);
    });

    describe("clearDiagnostics", () => {
        it("sends empty diagnostics for the given URI", () => {
            clearDiagnostics("file:///test.tp2");

            expect(mockSendDiagnostics).toHaveBeenCalledWith({
                uri: "file:///test.tp2",
                diagnostics: [],
            });
        });
    });

    describe("provider routing", () => {
        it("routes to registry provider when available and it handles it", async () => {
            mockRegistryHas.mockReturnValue(true);
            mockRegistryCompile.mockResolvedValue(true);

            await compile("file:///test.tp2", "weidu-tp2", false, "content");

            expect(mockRegistryCompile).toHaveBeenCalledWith(
                "weidu-tp2",
                "file:///test.tp2",
                "content",
                false
            );
        });

        it("clears diagnostics before provider compile", async () => {
            mockRegistryHas.mockReturnValue(true);
            mockRegistryCompile.mockResolvedValue(true);

            await compile("file:///test.tp2", "weidu-tp2", false, "content");

            expect(mockSendDiagnostics).toHaveBeenCalledWith({
                uri: "file:///test.tp2",
                diagnostics: [],
            });
        });
    });

    describe("typescript transpiler routing", () => {
        it("routes .td files to TD transpiler", async () => {
            mockTdCompile.mockResolvedValue("/output/test.d");

            await compile("file:///test.td", "typescript", false, "td content");

            expect(mockTdCompile).toHaveBeenCalledWith(
                "file:///test.td",
                "td content"
            );
        });

        it("shows success message after TD transpile", async () => {
            mockTdCompile.mockResolvedValue("/output/test.d");

            await compile("file:///test.td", "typescript", false, "td content");

            expect(mockShowInfo).toHaveBeenCalledWith(
                expect.stringContaining("Transpiled to")
            );
        });

        it("shows error message on TD transpile failure", async () => {
            mockTdCompile.mockRejectedValue(new Error("Parse error in TD"));

            await compile("file:///test.td", "typescript", false, "bad td");

            expect(mockShowError).toHaveBeenCalledWith(
                expect.stringContaining("TD: Parse error in TD")
            );
        });

        it("routes .tbaf files to TBAF transpiler", async () => {
            mockTbafCompile.mockResolvedValue("/output/test.baf");

            await compile("file:///test.tbaf", "typescript", false, "tbaf content");

            expect(mockTbafCompile).toHaveBeenCalledWith(
                "file:///test.tbaf",
                "tbaf content"
            );
        });

        it("shows error message on TBAF transpile failure", async () => {
            mockTbafCompile.mockRejectedValue(new Error("TBAF syntax error"));

            await compile("file:///test.tbaf", "typescript", false, "bad tbaf");

            expect(mockShowError).toHaveBeenCalledWith(
                expect.stringContaining("TBAF: TBAF syntax error")
            );
        });

        it("routes .tssl files to TSSL transpiler", async () => {
            mockTsslCompile.mockResolvedValue("/output/test.ssl");

            // The registry needs to handle the chained SSL compilation
            mockRegistryCompile.mockResolvedValue(true);

            await compile("file:///test.tssl", "typescript", false, "tssl content");

            expect(mockTsslCompile).toHaveBeenCalledWith(
                "file:///test.tssl",
                "tssl content"
            );
        });

        it("shows error message on TSSL transpile failure", async () => {
            mockTsslCompile.mockRejectedValue(new Error("TSSL error"));

            await compile("file:///test.tssl", "typescript", false, "bad tssl");

            expect(mockShowError).toHaveBeenCalledWith(
                expect.stringContaining("TSSL: TSSL error")
            );
        });
    });

    describe("unknown language", () => {
        it("logs message for unknown language", async () => {
            await compile("file:///test.xyz", "unknown-lang", true, "content");

            expect(mockShowInfo).toHaveBeenCalledWith(
                expect.stringContaining("Don't know how to compile")
            );
        });

        it("does not show message when not interactive", async () => {
            await compile("file:///test.xyz", "unknown-lang", false, "content");

            expect(mockShowInfo).not.toHaveBeenCalled();
        });
    });
});
