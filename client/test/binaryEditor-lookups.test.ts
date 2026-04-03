import { describe, expect, it } from "vitest";
import {
    formatEnumDisplayValue,
    resolveDisplayValue,
    resolveEnumLookup,
    resolveFlagLookup,
} from "../src/editors/binaryEditor-lookups";

describe("binaryEditor-lookups", () => {
    it("resolves MAP enum lookups by exact field name", () => {
        expect(resolveEnumLookup("map", "Header.Default Elevation", "Default Elevation")).toEqual({
            0: "0",
            1: "1",
            2: "2",
        });
        expect(resolveEnumLookup("map", "Header.Default Orientation", "Default Orientation")).toEqual({
            0: "NE",
            1: "E",
            2: "SE",
            3: "SW",
            4: "W",
            5: "NW",
        });
    });

    it("resolves MAP dynamic enums for script action fields", () => {
        expect(resolveEnumLookup("map", "Timer Scripts.Extent 0.Slot 0.Entry 0 Action", "Entry 0 Action")).toMatchObject({
            0: "no_p_proc",
            6: "use_p_proc",
            8: "use_skill_on_p_proc",
        });
        expect(resolveEnumLookup("map", "Timer Scripts.Extent 0.Slot 0.Entry 0 Action", "Entry 0 Action")).not.toHaveProperty("9");
        expect(resolveEnumLookup("map", "Timer Scripts.Extent 0.Slot 0.Entry 0 Action", "Entry 0 Action")).not.toHaveProperty("10");
        expect(resolveEnumLookup("map", "Timer Scripts.Extent 0.Slot 0.Entry 0 Action", "Entry 0 Action")).not.toHaveProperty("19");
        expect(resolveEnumLookup("map", "Timer Scripts.Extent 0.Slot 0.Entry 0 Action", "Entry 0 Action")).not.toHaveProperty("20");

        expect(resolveEnumLookup("map", "Timer Scripts.Extent 0.Slot 0.Entry 0 Action Being Used", "Entry 0 Action Being Used")).toMatchObject({
            0: "Small Guns",
            8: "Sneak",
            17: "Outdoorsman",
        });
    });

    it("resolves MAP flag lookups for dynamic script entries and object flags", () => {
        expect(resolveFlagLookup("map", "Timer Scripts.Extent 0.Slot 0.Entry 0 Flags", "Entry 0 Flags")).toEqual({
            0x01: "Loaded",
            0x02: "NoSpatial",
            0x04: "Executed",
            0x08: "NoSave",
            0x10: "NoRemove",
        });

        expect(resolveFlagLookup("map", "Objects Section.Elevation 0 Objects.Object 0.0 (Misc).Flags", "Flags")).toMatchObject({
            0x01: "Hidden",
            0x20000000: "LightThru",
            0x80000000: "ShootThru",
        });
    });

    it("keeps PRO Flags separate from MAP object Flags", () => {
        expect(resolveFlagLookup("pro", "Header.Flags", "Flags")).toMatchObject({
            0x08: "Flat",
        });
        expect(resolveDisplayValue("pro", "Header.Flags", "Flags", 0x08)).toContain("Flat");
        expect(resolveDisplayValue("map", "Objects Section.Elevation 0 Objects.Object 0.0 (Misc).Flags", "Flags", 0x20000000)).toContain("LightThru");
    });

    it("formats enum display values with numeric suffixes only when helpful", () => {
        expect(formatEnumDisplayValue("NE", 0)).toBe("NE (0)");
        expect(formatEnumDisplayValue("0", 0)).toBe("0");
        expect(formatEnumDisplayValue("17", 17)).toBe("17");
    });

    it("uses formatted enum display values for resolved displays", () => {
        expect(resolveDisplayValue("map", "Header.Default Orientation", "Default Orientation", 0)).toBe("NE (0)");
        expect(resolveDisplayValue("map", "Header.Default Elevation", "Default Elevation", 0)).toBe("0");
    });
});
