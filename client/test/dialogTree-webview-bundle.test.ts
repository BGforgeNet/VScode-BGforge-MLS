import { describe, expect, it } from "vitest";
import { build } from "esbuild";

describe("dialogTree-webview bundle", () => {
    it("includes runtime error hooks for browser failures", async () => {
        const result = await build({
            entryPoints: ["client/src/dialog-tree/dialogTree-webview.ts"],
            bundle: true,
            platform: "browser",
            format: "iife",
            write: false,
        });

        const output = result.outputFiles[0]?.text ?? "";
        expect(output).toContain("runtimeError");
        expect(output).toContain("unhandledrejection");
        expect(output).not.toContain("Binary editor runtime error");
    });
});
