/**
 * Integration tests for the bin CLI.
 * Runs the built bin-cli.js bundle as a child process to verify
 * exit codes, stdout output, and stderr diff reporting.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const CLI = path.resolve("cli/bin/out/bin-cli.js");
const NODE = process.execPath;
const FIXTURES = path.resolve("client/testFixture/proto");

/** Run the bin CLI, returning exit code, stdout, stderr. */
function run(...args: string[]): { code: number; stdout: string; stderr: string } {
    try {
        const stdout = execFileSync(NODE, [CLI, ...args], {
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
        });
        return { code: 0, stdout, stderr: "" };
    } catch (err: unknown) {
        const e = err as { status: number; stdout: string; stderr: string };
        return { code: e.status ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
    }
}

describe("bin CLI integration", () => {
    const tmpDir = path.resolve("tmp/cli-test-bin");

    beforeEach(() => {
        if (!fs.existsSync(CLI)) {
            throw new Error("bin-cli.js not built. Run: pnpm build:bin-cli");
        }
        fs.mkdirSync(tmpDir, { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    describe("stdout mode", () => {
        it("outputs parsed JSON to stdout", () => {
            const proFile = path.join(FIXTURES, "misc", "00000001.pro");
            if (!fs.existsSync(proFile)) return;
            const { code, stdout } = run(proFile);
            expect(code).toBe(0);
            // Output should be valid JSON
            const parsed = JSON.parse(stdout);
            expect(parsed).toBeDefined();
        });

        it("outputs JSON with trailing newline", () => {
            const proFile = path.join(FIXTURES, "misc", "00000001.pro");
            if (!fs.existsSync(proFile)) return;
            const { stdout } = run(proFile);
            expect(stdout.endsWith("\n")).toBe(true);
        });
    });

    describe("check mode", () => {
        it("exits 0 when JSON snapshot matches", () => {
            const proFile = path.join(FIXTURES, "misc", "00000001.pro");
            const jsonFile = path.join(FIXTURES, "misc", "00000001.json");
            if (!fs.existsSync(proFile) || !fs.existsSync(jsonFile)) return;
            const { code } = run(proFile, "--check");
            expect(code).toBe(0);
        });

        it("exits 1 when JSON snapshot is stale (returns 'changed')", () => {
            const proFile = path.join(FIXTURES, "misc", "00000001.pro");
            if (!fs.existsSync(proFile)) return;

            // Copy .pro to temp, create stale .json
            const tmpPro = path.join(tmpDir, "test.pro");
            const tmpJson = path.join(tmpDir, "test.json");
            fs.copyFileSync(proFile, tmpPro);
            fs.writeFileSync(tmpJson, '{"stale": true}\n');

            const { code, stderr } = run(tmpPro, "--check");
            expect(code).toBe(1);
            expect(stderr).toContain("DIFF:");
        });

        it("shows line-by-line diff on stderr for stale snapshot", () => {
            const proFile = path.join(FIXTURES, "misc", "00000001.pro");
            if (!fs.existsSync(proFile)) return;

            const tmpPro = path.join(tmpDir, "diff.pro");
            const tmpJson = path.join(tmpDir, "diff.json");
            fs.copyFileSync(proFile, tmpPro);
            fs.writeFileSync(tmpJson, '{"wrong": "content"}\n');

            const { stderr } = run(tmpPro, "--check");
            expect(stderr).toContain("Line ");
            expect(stderr).toContain("    -");
            expect(stderr).toContain("    +");
        });

        it("exits 1 when JSON snapshot is missing", () => {
            const proFile = path.join(FIXTURES, "misc", "00000001.pro");
            if (!fs.existsSync(proFile)) return;

            // Copy .pro to temp without .json
            const tmpPro = path.join(tmpDir, "nojson.pro");
            fs.copyFileSync(proFile, tmpPro);

            const { code, stderr } = run(tmpPro, "--check");
            expect(code).toBe(1);
            expect(stderr).toContain("Missing:");
        });
    });

    describe("save mode", () => {
        it("writes JSON snapshot file", () => {
            const proFile = path.join(FIXTURES, "misc", "00000001.pro");
            if (!fs.existsSync(proFile)) return;

            const tmpPro = path.join(tmpDir, "save.pro");
            fs.copyFileSync(proFile, tmpPro);

            const { code, stdout } = run(tmpPro, "--save");
            expect(code).toBe(0);
            expect(stdout).toContain("Saved:");
            const jsonPath = path.join(tmpDir, "save.json");
            expect(fs.existsSync(jsonPath)).toBe(true);
            // Verify it's valid JSON with trailing newline
            const content = fs.readFileSync(jsonPath, "utf-8");
            expect(content.endsWith("\n")).toBe(true);
            JSON.parse(content);
        });

        it("does not rewrite up-to-date snapshot", () => {
            const proFile = path.join(FIXTURES, "misc", "00000001.pro");
            if (!fs.existsSync(proFile)) return;

            const tmpPro = path.join(tmpDir, "noop.pro");
            fs.copyFileSync(proFile, tmpPro);

            // First save
            run(tmpPro, "--save");
            // Second save should detect no change
            const { code, stdout } = run(tmpPro, "--save");
            expect(code).toBe(0);
            expect(stdout).not.toContain("Saved:");
        });
    });

    describe("error handling", () => {
        it("exits 1 for parse errors in binary", () => {
            const badFile = path.join(FIXTURES, "bad", "too-small.pro");
            if (!fs.existsSync(badFile)) return;
            const { code, stderr } = run(badFile);
            expect(code).toBe(1);
            expect(stderr).toContain("Error parsing");
        });

        it("exits 1 for nonexistent file", () => {
            const { code, stderr } = run("/nonexistent/file.pro");
            expect(code).toBe(1);
            expect(stderr).toContain("Not found");
        });

        it("catches read errors gracefully via safeProcess", () => {
            // Create an unreadable file (if running as non-root)
            const file = path.join(tmpDir, "unreadable.pro");
            fs.writeFileSync(file, "x");
            fs.chmodSync(file, 0o000);

            const { code, stderr } = run(file);
            // Should get error either from parser or read failure
            expect(code).toBe(1);
            expect(stderr.length).toBeGreaterThan(0);

            // Restore permissions for cleanup
            fs.chmodSync(file, 0o644);
        });
    });

    describe("directory mode", () => {
        it("requires -r flag", () => {
            const { code, stderr } = run(tmpDir);
            expect(code).toBe(1);
            expect(stderr).toContain("Use -r for recursive");
        });

        it("check mode exits 1 when any snapshot is stale", () => {
            const proFile = path.join(FIXTURES, "misc", "00000001.pro");
            if (!fs.existsSync(proFile)) return;

            const tmpPro = path.join(tmpDir, "a.pro");
            const tmpJson = path.join(tmpDir, "a.json");
            fs.copyFileSync(proFile, tmpPro);
            fs.writeFileSync(tmpJson, '{"stale": true}\n');

            const { code } = run(tmpDir, "-r", "--check", "-q");
            expect(code).toBe(1);
        });

        it("check mode exits 0 when all snapshots match", () => {
            const proFile = path.join(FIXTURES, "misc", "00000001.pro");
            if (!fs.existsSync(proFile)) return;

            const tmpPro = path.join(tmpDir, "ok.pro");
            fs.copyFileSync(proFile, tmpPro);
            // Save first to create matching snapshot
            run(tmpPro, "--save");

            const { code } = run(tmpDir, "-r", "--check", "-q");
            expect(code).toBe(0);
        });
    });
});
