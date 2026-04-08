import { describe, expect, it } from "vitest";
import { build } from "esbuild";

describe("binaryEditor-webview bundle", () => {
    it("does not pull zod into the browser bundle", async () => {
        const result = await build({
            entryPoints: ["client/src/editors/binaryEditor-webview.ts"],
            bundle: true,
            platform: "browser",
            format: "iife",
            write: false,
        });

        const output = result.outputFiles[0]?.text ?? "";
        expect(output).not.toContain("node_modules/.pnpm/zod");
        expect(output).not.toContain("ZodError");
    });
});
