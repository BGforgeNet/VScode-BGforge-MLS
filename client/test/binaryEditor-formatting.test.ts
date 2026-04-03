import { describe, expect, it } from "vitest";
import {
    formatEditableNumberValue,
    formatNumericValue,
    parseEditableNumberValue,
    resolveNumericFormat,
    sanitizeEditableNumberValue,
} from "../src/editors/binaryEditor-formatting";

describe("binaryEditor-formatting", () => {
    it("uses hex32 formatting for MAP PID/FID/CID/SID fields", () => {
        expect(resolveNumericFormat("map", "PID")).toBe("hex32");
        expect(resolveNumericFormat("map", "FID")).toBe("hex32");
        expect(resolveNumericFormat("map", "CID")).toBe("hex32");
        expect(resolveNumericFormat("map", "SID")).toBe("hex32");
        expect(resolveNumericFormat("map", "Entry 0 SID")).toBe("hex32");
        expect(resolveNumericFormat("map", "Rotation")).toBe("decimal");
    });

    it("formats signed 32-bit values as raw hex bit patterns", () => {
        expect(formatNumericValue(-1, "hex32")).toBe("0xFFFFFFFF");
        expect(formatNumericValue(0x0500000C, "hex32")).toBe("0x500000C");
    });

    it("formats editable numeric values without a hex prefix", () => {
        expect(formatEditableNumberValue(42, "decimal")).toBe("42");
        expect(formatEditableNumberValue(0x0500000C, "hex32")).toBe("500000C");
    });

    it("sanitizes editable values by numeric format", () => {
        expect(sanitizeEditableNumberValue("12a-3", "decimal")).toBe("123");
        expect(sanitizeEditableNumberValue("-123", "decimal")).toBe("-123");
        expect(sanitizeEditableNumberValue("5g0x2z6", "hex32")).toBe("5026");
        expect(sanitizeEditableNumberValue("abCD", "hex32")).toBe("ABCD");
    });

    it("parses editable values by numeric format", () => {
        expect(parseEditableNumberValue("-12", "decimal")).toBe(-12);
        expect(parseEditableNumberValue("5000026", "hex32")).toBe(0x5000026);
        expect(Number.isNaN(parseEditableNumberValue("", "hex32"))).toBe(true);
        expect(Number.isNaN(parseEditableNumberValue("xyz", "hex32"))).toBe(true);
    });
});
