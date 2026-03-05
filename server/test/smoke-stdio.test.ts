/**
 * Smoke test: verifies the LSP server starts over stdio, responds to
 * initialize, and shuts down cleanly. Requires a built server bundle
 * at server/out/server.js (run `pnpm build:base:server` first).
 */

import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { describe, it, expect, afterEach } from "vitest";

const SERVER_PATH = join(__dirname, "..", "out", "server.js");

/** Encode a JSON-RPC message with Content-Length header. */
function encode(msg: object): string {
    const body = JSON.stringify(msg);
    return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
}

/** Read one JSON-RPC response from a buffer, returning [parsed, remaining]. */
function tryParse(buf: string): [unknown | null, string] {
    const headerEnd = buf.indexOf("\r\n\r\n");
    if (headerEnd === -1) return [null, buf];

    const header = buf.slice(0, headerEnd);
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) return [null, buf];

    const len = parseInt(match[1]!, 10);
    const bodyStart = headerEnd + 4;
    if (buf.length < bodyStart + len) return [null, buf];

    const body = buf.slice(bodyStart, bodyStart + len);
    const rest = buf.slice(bodyStart + len);
    return [JSON.parse(body), rest];
}

/** Send a request and wait for a response with the matching id. */
function request(
    proc: ChildProcess,
    msg: { jsonrpc: string; id: number; method: string; params: unknown },
    timeoutMs = 30_000,
): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
        let buf = "";
        const timer = setTimeout(
            () => reject(new Error(`Timeout waiting for response to ${msg.method}`)),
            timeoutMs,
        );

        const onData = (chunk: Buffer) => {
            buf += chunk.toString();
            let parsed: unknown;
            [parsed, buf] = tryParse(buf);
            while (parsed !== null) {
                const obj = parsed as Record<string, unknown>;
                if (obj.id === msg.id) {
                    clearTimeout(timer);
                    proc.stdout!.off("data", onData);
                    resolve(obj);
                    return;
                }
                [parsed, buf] = tryParse(buf);
            }
        };

        proc.stdout!.on("data", onData);
        proc.stdin!.write(encode(msg));
    });
}

/** Send a notification (no response expected). */
function notify(
    proc: ChildProcess,
    msg: { jsonrpc: string; method: string; params?: unknown },
): void {
    proc.stdin!.write(encode(msg));
}

describe("LSP stdio smoke test", () => {
    let proc: ChildProcess | undefined;

    afterEach(() => {
        if (proc && proc.exitCode === null) {
            proc.kill("SIGKILL");
        }
        proc = undefined;
    });

    it("initializes, responds with capabilities, and shuts down", async () => {
        proc = spawn("node", [SERVER_PATH, "--stdio"], {
            stdio: ["pipe", "pipe", "pipe"],
        });

        // Collect stderr for diagnostics on failure
        let stderr = "";
        proc.stderr!.on("data", (chunk: Buffer) => {
            stderr += chunk.toString();
        });

        // Send initialize
        const initResponse = await request(proc, {
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
                processId: process.pid,
                capabilities: {},
                rootUri: null,
                workspaceFolders: null,
            },
        });

        expect(initResponse.result).toBeDefined();
        const result = initResponse.result as Record<string, unknown>;
        const capabilities = result.capabilities as Record<string, unknown>;

        // Verify key capabilities are present
        expect(capabilities.completionProvider).toBeDefined();
        expect(capabilities.hoverProvider).toBe(true);
        expect(capabilities.textDocumentSync).toBeDefined();

        // Send initialized notification
        notify(proc, { jsonrpc: "2.0", method: "initialized", params: {} });

        // Send shutdown request
        const shutdownResponse = await request(proc, {
            jsonrpc: "2.0",
            id: 2,
            method: "shutdown",
            params: null,
        });
        expect(shutdownResponse.result).toBe(null);

        // Send exit notification
        notify(proc, { jsonrpc: "2.0", method: "exit" });

        // Wait for clean exit
        const exitCode = await new Promise<number | null>((resolve) => {
            const timer = setTimeout(() => {
                proc!.kill("SIGKILL");
                resolve(null);
            }, 5_000);
            proc!.on("exit", (code) => {
                clearTimeout(timer);
                resolve(code);
            });
        });

        expect(exitCode, `Server exited uncleanly. stderr:\n${stderr}`).toBe(0);
    });
});
