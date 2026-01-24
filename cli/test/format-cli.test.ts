/**
 * Integration tests for the format CLI.
 * Runs the built format-cli.js bundle as a child process to verify
 * exit codes, stdout output, and stderr diff reporting.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const CLI = path.resolve("cli/format/out/format-cli.js");
const NODE = process.execPath;

/** Run the format CLI, returning exit code, stdout, stderr. */
function run(...args: string[]): { code: number; stdout: string; stderr: string } {
    try {
        const stdout = execFileSync(NODE, ["--no-warnings", CLI, ...args], {
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
        });
        return { code: 0, stdout, stderr: "" };
    } catch (err: unknown) {
        const e = err as { status: number; stdout: string; stderr: string };
        return { code: e.status ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
    }
}

describe("format CLI integration", () => {
    const tmpDir = path.resolve("cli/test/.tmp-format");

    beforeEach(() => {
        if (!fs.existsSync(CLI)) {
            throw new Error("format-cli.js not built. Run: pnpm build:format-cli");
        }
        fs.mkdirSync(tmpDir, { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    describe("stdout mode", () => {
        it("outputs formatted content to stdout", () => {
            // Valid BAF with wrong indentation (content is preserved, only whitespace changes)
            const input = "IF\nTrue()\nTHEN\n  RESPONSE #100\n  NoAction()\nEND\n";
            const file = path.join(tmpDir, "test.baf");
            fs.writeFileSync(file, input);
            const { code, stdout } = run(file);
            expect(code).toBe(0);
            expect(stdout.length).toBeGreaterThan(0);
        });
    });

    describe("check mode", () => {
        it("exits 0 for already-formatted file", () => {
            // Use a known formatted sample
            const sampleDir = path.resolve("grammars/weidu-baf/test/samples-expected");
            const samples = fs.readdirSync(sampleDir);
            if (samples.length === 0) return;
            const file = path.join(sampleDir, samples[0]!);
            const { code } = run(file, "--check");
            expect(code).toBe(0);
        });

        it("exits 1 for unformatted file", () => {
            // Valid BAF with wrong indentation
            const input = "IF\nTrue()\nTHEN\n  RESPONSE #100\n  NoAction()\nEND\n";
            const file = path.join(tmpDir, "bad.baf");
            fs.writeFileSync(file, input);
            const { code, stderr } = run(file, "--check");
            expect(code).toBe(1);
            expect(stderr).toContain("DIFF:");
        });

        it("shows line-by-line diff on stderr", () => {
            const input = "IF\nTrue()\nTHEN\n  RESPONSE #100\n  NoAction()\nEND\n";
            const file = path.join(tmpDir, "diff.baf");
            fs.writeFileSync(file, input);
            const { stderr } = run(file, "--check");
            expect(stderr).toContain("Line ");
            expect(stderr).toContain("    -");
            expect(stderr).toContain("    +");
        });
    });

    describe("save mode", () => {
        it("writes formatted output back to file", () => {
            const input = "IF\nTrue()\nTHEN\n  RESPONSE #100\n  NoAction()\nEND\n";
            const file = path.join(tmpDir, "save.baf");
            fs.writeFileSync(file, input);
            const { code, stdout } = run(file, "--save");
            expect(code).toBe(0);
            expect(stdout).toContain("Formatted:");
            const result = fs.readFileSync(file, "utf-8");
            expect(result).not.toBe(input);
        });

        it("does not rewrite already-formatted file", () => {
            const sampleDir = path.resolve("grammars/weidu-baf/test/samples-expected");
            const samples = fs.readdirSync(sampleDir);
            if (samples.length === 0) return;
            const src = path.join(sampleDir, samples[0]!);
            const file = path.join(tmpDir, samples[0]!);
            fs.copyFileSync(src, file);
            const { code, stdout } = run(file, "--save");
            expect(code).toBe(0);
            expect(stdout).not.toContain("Formatted:");
        });
    });

    describe("directory mode", () => {
        it("requires -r flag", () => {
            const { code, stderr } = run(tmpDir);
            expect(code).toBe(1);
            expect(stderr).toContain("Use -r for recursive");
        });

        it("check mode exits 1 when files need formatting", () => {
            const input = "IF\nTrue()\nTHEN\n  RESPONSE #100\n  NoAction()\nEND\n";
            fs.writeFileSync(path.join(tmpDir, "a.baf"), input);
            const { code } = run(tmpDir, "-r", "--check", "-q");
            expect(code).toBe(1);
        });

        it("prints summary in non-quiet mode", () => {
            const input = "IF\nTrue()\nTHEN\n  RESPONSE #100\n  NoAction()\nEND\n";
            fs.writeFileSync(path.join(tmpDir, "a.baf"), input);
            const { stdout } = run(tmpDir, "-r", "--save");
            expect(stdout).toContain("Summary:");
        });
    });

    describe("error handling", () => {
        it("exits 1 for unsupported file type", () => {
            const file = path.join(tmpDir, "test.xyz");
            fs.writeFileSync(file, "content");
            const { code, stderr } = run(file);
            expect(code).toBe(1);
            expect(stderr).toContain("Unsupported file type");
        });

        it("exits 1 for nonexistent file", () => {
            const { code, stderr } = run("/nonexistent/file.baf");
            expect(code).toBe(1);
            expect(stderr).toContain("Not found");
        });
    });
});
