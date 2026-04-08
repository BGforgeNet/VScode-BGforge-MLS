import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";

describe("binaryEditor-webview source", () => {
    it("routes update and validation messages by fieldId before display path", () => {
        const source = fs.readFileSync(path.resolve("client/src/editors/binaryEditor-webview.ts"), "utf8");

        expect(source).toContain("updateField(msg.fieldId, msg.displayValue, msg.rawValue);");
        expect(source).toContain("showFieldError(msg.fieldId ?? msg.fieldPath, msg.message);");
    });
});
