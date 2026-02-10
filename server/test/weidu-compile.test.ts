/**
 * Unit tests for weidu-compile.ts - WeiDU output parsing and compile dispatch.
 * Tests regex-based parsing of WeiDU error output and compilation workflow.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

const mockExecFile = vi.fn();
const mockWriteFileSync = vi.fn();

vi.mock("child_process", () => ({
    execFile: (...args: unknown[]) => mockExecFile(...args),
}));

vi.mock("fs", () => ({
    writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
}));

const mockShowInfo = vi.fn();
const mockShowWarning = vi.fn();
const mockShowError = vi.fn();
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

// Import after mocks are set up.
// parseWeiduOutput is not exported, so we test it indirectly through compile(),
// and also access it through module internals.
// Actually, parseWeiduOutput is a private function. We need to test it via the module.
// Let's import the module and test through compile's callback behavior.

// Since parseWeiduOutput is not exported, we'll test it through the compile function
// which calls it internally. We can verify parse results through the diagnostics sent.
import { compile } from "../src/weidu-compile";
import type { WeiDUsettings } from "../src/settings";

describe("weidu-compile", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const baseSettings: WeiDUsettings = {
        path: "/usr/bin/weidu",
        gamePath: "/games/bg2",
    };

    describe("compile() - extension validation", () => {
        it("rejects unsupported file extensions", () => {
            compile("file:///test.txt", baseSettings, true, "content");

            expect(mockExecFile).not.toHaveBeenCalled();
            expect(mockShowInfo).toHaveBeenCalledWith(
                expect.stringContaining("Focus a WeiDU file to parse!")
            );
        });

        it("rejects .d without game path", () => {
            const noGameSettings: WeiDUsettings = { path: "/usr/bin/weidu", gamePath: "" };
            compile("file:///test.d", noGameSettings, true, "content");

            expect(mockExecFile).not.toHaveBeenCalled();
            expect(mockShowWarning).toHaveBeenCalledWith(
                expect.stringContaining("can't parse D or BAF")
            );
        });

        it("rejects .baf without game path", () => {
            const noGameSettings: WeiDUsettings = { path: "/usr/bin/weidu", gamePath: "" };
            compile("file:///test.baf", noGameSettings, true, "content");

            expect(mockExecFile).not.toHaveBeenCalled();
            expect(mockShowWarning).toHaveBeenCalled();
        });

        it("allows .tp2 without game path (uses --nogame)", () => {
            const noGameSettings: WeiDUsettings = { path: "/usr/bin/weidu", gamePath: "" };
            compile("file:///test.tp2", noGameSettings, false, "content");

            expect(mockExecFile).toHaveBeenCalled();
            const args = mockExecFile.mock.calls[0][1] as string[];
            expect(args).toContain("--nogame");
        });

        it("dispatches valid .tp2 extension", () => {
            compile("file:///test.tp2", baseSettings, false, "content");

            expect(mockExecFile).toHaveBeenCalled();
            const args = mockExecFile.mock.calls[0][1] as string[];
            expect(args).toContain("tp2");
        });

        it("dispatches valid .d extension with game path", () => {
            compile("file:///test.d", baseSettings, false, "content");

            expect(mockExecFile).toHaveBeenCalled();
            const args = mockExecFile.mock.calls[0][1] as string[];
            expect(args).toContain("d");
        });

        it("dispatches valid .baf extension with game path", () => {
            compile("file:///test.baf", baseSettings, false, "content");

            expect(mockExecFile).toHaveBeenCalled();
            const args = mockExecFile.mock.calls[0][1] as string[];
            expect(args).toContain("baf");
        });

        it("dispatches .tpa as tpa type", () => {
            compile("file:///test.tpa", baseSettings, false, "content");

            expect(mockExecFile).toHaveBeenCalled();
            const args = mockExecFile.mock.calls[0][1] as string[];
            expect(args).toContain("tpa");
        });

        it("dispatches .tph as tpa type", () => {
            compile("file:///test.tph", baseSettings, false, "content");

            expect(mockExecFile).toHaveBeenCalled();
            const args = mockExecFile.mock.calls[0][1] as string[];
            expect(args).toContain("tpa");
        });

        it("dispatches .tpp as tpp type", () => {
            compile("file:///test.tpp", baseSettings, false, "content");

            expect(mockExecFile).toHaveBeenCalled();
            const args = mockExecFile.mock.calls[0][1] as string[];
            expect(args).toContain("tpp");
        });
    });

    describe("compile() - command construction", () => {
        it("includes --game flag when gamePath is set", () => {
            compile("file:///test.tp2", baseSettings, false, "content");

            const args = mockExecFile.mock.calls[0][1] as string[];
            expect(args).toContain("--game");
            expect(args).toContain("/games/bg2");
        });

        it("includes standard weidu flags", () => {
            compile("file:///test.tp2", baseSettings, false, "content");

            const args = mockExecFile.mock.calls[0][1] as string[];
            expect(args).toContain("--no-exit-pause");
            expect(args).toContain("--noautoupdate");
            expect(args).toContain("--debug-assign");
            expect(args).toContain("--parse-check");
        });

        it("writes text to temp file before executing", () => {
            compile("file:///test.tp2", baseSettings, false, "my content");

            expect(mockWriteFileSync).toHaveBeenCalledWith(
                expect.stringContaining("tmp.tp2"),
                "my content"
            );
        });
    });

    describe("compile() - output handling via callback", () => {
        it("shows success message for clean output in interactive mode", () => {
            compile("file:///test.tp2", baseSettings, true, "content");

            // Get the callback from execFile
            const callback = mockExecFile.mock.calls[0][3] as (
                err: Error | null,
                stdout: string,
                stderr: string
            ) => void;

            callback(null, "Parsing complete", "");

            expect(mockShowInfo).toHaveBeenCalledWith(
                expect.stringContaining("Succesfully parsed")
            );
        });

        it("shows error message when errors are found in output", () => {
            compile("file:///test.tp2", baseSettings, true, "content");

            const callback = mockExecFile.mock.calls[0][3] as (
                err: { code: number } | null,
                stdout: string,
                stderr: string
            ) => void;

            callback(
                { code: 1 } as { code: number },
                "[ua.tp2]  ERROR at line 30 column 1-63",
                ""
            );

            expect(mockShowError).toHaveBeenCalledWith(
                expect.stringContaining("Failed to parse")
            );
        });

        it("parses standard error format from stdout", () => {
            compile("file:///test.tp2", baseSettings, true, "content");

            const callback = mockExecFile.mock.calls[0][3] as (
                err: { code: number } | null,
                stdout: string,
                stderr: string
            ) => void;

            callback(
                { code: 1 } as { code: number },
                "[ua.tp2]  ERROR at line 30 column 1-63",
                ""
            );

            expect(mockSendDiagnostics).toHaveBeenCalled();
        });

        it("parses PARSE ERROR variant from stdout", () => {
            compile("file:///test.tp2", baseSettings, true, "content");

            const callback = mockExecFile.mock.calls[0][3] as (
                err: { code: number } | null,
                stdout: string,
                stderr: string
            ) => void;

            callback(
                { code: 1 } as { code: number },
                "[ua.tp2]  PARSE ERROR at line 15 column 5-20",
                ""
            );

            expect(mockSendDiagnostics).toHaveBeenCalled();
        });

        it("handles multiple errors in output", () => {
            compile("file:///test.tp2", baseSettings, true, "content");

            const callback = mockExecFile.mock.calls[0][3] as (
                err: { code: number } | null,
                stdout: string,
                stderr: string
            ) => void;

            const multiError =
                "[ua.tp2]  ERROR at line 30 column 1-63\n" +
                "[ua.tp2]  PARSE ERROR at line 45 column 10-25\n";

            callback({ code: 1 } as { code: number }, multiError, "");

            expect(mockSendDiagnostics).toHaveBeenCalled();
        });

        it("handles clean output (no errors)", () => {
            compile("file:///test.tp2", baseSettings, false, "content");

            const callback = mockExecFile.mock.calls[0][3] as (
                err: null,
                stdout: string,
                stderr: string
            ) => void;

            callback(null, "Parsing complete. No errors.", "");

            // No diagnostics should be sent for clean output
            expect(mockSendDiagnostics).not.toHaveBeenCalled();
        });

        it("handles empty stdout", () => {
            compile("file:///test.tp2", baseSettings, false, "content");

            const callback = mockExecFile.mock.calls[0][3] as (
                err: null,
                stdout: string,
                stderr: string
            ) => void;

            callback(null, "", "");

            expect(mockSendDiagnostics).not.toHaveBeenCalled();
        });

        it("does not show interactive messages when interactive is false", () => {
            compile("file:///test.tp2", baseSettings, false, "content");

            const callback = mockExecFile.mock.calls[0][3] as (
                err: null,
                stdout: string,
                stderr: string
            ) => void;

            callback(null, "Parsing complete", "");

            expect(mockShowInfo).not.toHaveBeenCalled();
            expect(mockShowError).not.toHaveBeenCalled();
        });

        it("detects errors even with zero exit code when parse errors exist in stdout", () => {
            compile("file:///test.tp2", baseSettings, true, "content");

            const callback = mockExecFile.mock.calls[0][3] as (
                err: null,
                stdout: string,
                stderr: string
            ) => void;

            // WeiDU sometimes returns 0 exit code but has errors in stdout
            callback(null, "[test.tp2]  ERROR at line 5 column 1-10", "");

            expect(mockSendDiagnostics).toHaveBeenCalled();
            expect(mockShowError).toHaveBeenCalled();
        });
    });
});
