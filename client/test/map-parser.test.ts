import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { mapParser } from "../src/parsers/map";

const REAL_MAPS = [
    path.resolve("external/fallout/Fallout2_Restoration_Project/data/maps/artemple.map"),
    path.resolve("external/fallout/Fallout2_Restoration_Project/data/maps/arvillag.map"),
    path.resolve("external/fallout/Fallout2_Restoration_Project/data/maps/denbus1.map"),
    path.resolve("external/fallout/Fallout2_Restoration_Project/data/maps/navarro.map"),
    path.resolve("external/fallout/Fallout2_Restoration_Project/data/maps/vault13.map"),
    path.resolve("external/fallout/Fallout2_Restoration_Project/data/maps/newr1.map"),
    path.resolve("external/fallout/Fallout2_Restoration_Project/data/maps/sftanker.map"),
] as const;

function loadMap(mapPath: string): Uint8Array {
    return new Uint8Array(fs.readFileSync(mapPath));
}

function findFieldByName(fields: unknown[], name: string): { value: unknown; type?: unknown; rawValue?: unknown } {
    const found = fields.find((field) => {
        if (!field || typeof field !== "object") return false;
        return "name" in field && field.name === name;
    });

    if (!found || typeof found !== "object" || !("value" in found)) {
        throw new Error(`Missing field ${name}`);
    }

    return found as { value: unknown; type?: unknown; rawValue?: unknown };
}

function findGroupByName(fields: unknown[], name: string): { name: string; fields: unknown[] } {
    const found = fields.find((field) => {
        if (!field || typeof field !== "object") return false;
        return "name" in field && field.name === name && "fields" in field;
    });

    if (!found || typeof found !== "object" || !("fields" in found)) {
        throw new Error(`Missing group ${name}`);
    }

    return found as { name: string; fields: unknown[] };
}

describe("MAP parser - interface", () => {
    it("has id 'map'", () => {
        expect(mapParser.id).toBe("map");
    });

    it("has name 'Fallout MAP'", () => {
        expect(mapParser.name).toBe("Fallout MAP");
    });

    it("handles .map extension", () => {
        expect(mapParser.extensions).toContain("map");
    });

    it("has serialize method", () => {
        expect(typeof mapParser.serialize).toBe("function");
    });
});

describe("MAP parser - real maps", () => {
    it.each([
        REAL_MAPS[0],
        REAL_MAPS[1],
        REAL_MAPS[2],
        REAL_MAPS[3],
        REAL_MAPS[4],
        REAL_MAPS[5],
    ])("strictly parses %s without errors", (mapPath) => {
        const result = mapParser.parse(loadMap(mapPath));
        expect(result.errors).toBeUndefined();
        expect(result.root.fields.length).toBeGreaterThan(1);
    });

    it.each(REAL_MAPS)("round-trips %s byte-for-byte", (mapPath) => {
        const mapData = loadMap(mapPath);
        const result = mapParser.parse(mapData, { gracefulMapBoundaries: true });

        expect(result.errors).toBeUndefined();
        const serialized = mapParser.serialize!(result);
        expect(Buffer.from(serialized).equals(Buffer.from(mapData))).toBe(true);
    });

    it("re-packs tile ids and flags into the original 32-bit word", () => {
        const mapData = loadMap(REAL_MAPS[0]);
        const result = mapParser.parse(mapData, { gracefulMapBoundaries: true });
        const tileGroup = result.root.fields.find((field) => "name" in field && field.name === "Elevation 0 Tiles");

        expect(tileGroup).toBeDefined();
        expect("fields" in (tileGroup!)).toBe(true);

        const tileFields = (tileGroup as { fields: unknown[] }).fields;
        const floorField = findFieldByName(tileFields, "Tile 0 Floor");
        const floorFlagsField = findFieldByName(tileFields, "Tile 0 Floor Flags");
        const roofField = findFieldByName(tileFields, "Tile 0 Roof");
        const roofFlagsField = findFieldByName(tileFields, "Tile 0 Roof Flags");

        floorField.value = 0x234;
        floorFlagsField.value = 0x5;
        roofField.value = 0x678;
        roofFlagsField.value = 0x9;

        const serialized = mapParser.serialize!(result);
        const view = new DataView(serialized.buffer, serialized.byteOffset, serialized.byteLength);

        expect(view.getUint32(240, false)).toBe(0x9678_5234);
    });

    it("parses object section counts and leaves a TODO when subtype resolution is missing", () => {
        const mapData = loadMap(REAL_MAPS[2]);
        const result = mapParser.parse(mapData, { gracefulMapBoundaries: true });
        const objectsSection = result.root.fields.find((field) => "name" in field && field.name === "Objects Section");

        expect(objectsSection).toBeDefined();
        expect("fields" in (objectsSection!)).toBe(true);

        const objectFields = (objectsSection as { fields: unknown[] }).fields;
        const totalObjects = findFieldByName(objectFields, "Total Objects");
        expect(totalObjects.value).toBe(4886);

        const elevation0 = objectFields.find((field) =>
            field && typeof field === "object" && "name" in field && field.name === "Elevation 0 Objects"
        ) as { fields: unknown[] } | undefined;
        expect(elevation0).toBeDefined();
        expect(findFieldByName(elevation0!.fields, "Object Count").value).toBe(4294);

        const todoNote = objectFields.find((field) =>
            field && typeof field === "object" && "name" in field && field.name === "TODO"
        ) as { value: unknown } | undefined;
        expect(todoNote?.value).toContain("PRO");
    });

    it("parses arcaves.map object headers at the correct script boundary", () => {
        const mapData = loadMap(path.resolve("external/fallout/Fallout2_Restoration_Project/data/maps/arcaves.map"));
        const result = mapParser.parse(mapData, { gracefulMapBoundaries: true });

        expect(result.errors).toBeUndefined();

        const objectsSection = findGroupByName(result.root.fields, "Objects Section");
        const elevation0 = findGroupByName(objectsSection.fields, "Elevation 0 Objects");
        const firstObject = elevation0.fields.find((field) =>
            field && typeof field === "object" && "name" in field && field.name === "Object 0.0 (Misc)"
        ) as { fields: unknown[] } | undefined;

        expect(firstObject).toBeDefined();
        expect(findFieldByName(firstObject!.fields, "Rotation").rawValue).toBe(0);
        expect(findFieldByName(firstObject!.fields, "Elevation").rawValue).toBe(0);
        expect(findFieldByName(firstObject!.fields, "PID").value).toBe(83886092);
        expect(findFieldByName(firstObject!.fields, "SID").value).toBe(-1);
        expect(findFieldByName(firstObject!.fields, "Field 74").value).toBe(0);
    });

    it("stops MAP filename decoding at the first NUL byte", () => {
        const mapData = loadMap(path.resolve("external/fallout/Fallout2_Restoration_Project/data/maps/newr2.map"));
        const result = mapParser.parse(mapData);

        expect(result.errors).toBeUndefined();

        const header = findGroupByName(result.root.fields, "Header");
        expect(findFieldByName(header.fields, "Filename").value).toBe("NEWR2.MAP");
    });

    it("exposes MAP enums and flags with semantic field types", () => {
        const mapData = loadMap(path.resolve("external/fallout/Fallout2_Restoration_Project/data/maps/arcaves.map"));
        const result = mapParser.parse(mapData);

        expect(result.errors).toBeUndefined();

        const header = findGroupByName(result.root.fields, "Header");
        expect(findFieldByName(header.fields, "Map Flags").type).toBe("flags");
        expect(findFieldByName(header.fields, "Default Elevation").type).toBe("enum");
        expect(findFieldByName(header.fields, "Default Orientation").type).toBe("enum");

        const firstScriptGroup = result.root.fields.find((field) =>
            field && typeof field === "object" && "name" in field && typeof field.name === "string" && field.name.endsWith("Scripts") && "fields" in field
        ) as { fields: unknown[] } | undefined;
        expect(firstScriptGroup).toBeDefined();

        const extent0 = findGroupByName(firstScriptGroup!.fields, "Extent 0");
        const slot0 = findGroupByName(extent0.fields, "Slot 0");
        expect(findFieldByName(slot0.fields, "Entry 0 Flags").type).toBe("flags");
        expect(findFieldByName(slot0.fields, "Entry 0 Action").type).toBe("enum");
        expect(findFieldByName(slot0.fields, "Entry 0 Action Being Used").type).toBe("enum");

        const objectsSection = findGroupByName(result.root.fields, "Objects Section");
        const elevation0 = findGroupByName(objectsSection.fields, "Elevation 0 Objects");
        const firstObject = elevation0.fields.find((field) =>
            field && typeof field === "object" && "name" in field && field.name === "Object 0.0 (Misc)"
        ) as { fields: unknown[] } | undefined;

        expect(firstObject).toBeDefined();
        expect(findFieldByName(firstObject!.fields, "Flags").type).toBe("flags");
        expect(findFieldByName(firstObject!.fields, "Rotation").type).toBe("enum");
        expect(findFieldByName(firstObject!.fields, "Elevation").type).toBe("enum");

        const exitGridResult = mapParser.parse(
            loadMap(path.resolve("external/fallout/Fallout2_Restoration_Project/data/maps/bhrnddst.map"))
        );
        expect(exitGridResult.errors).toBeUndefined();

        const exitObjectsSection = findGroupByName(exitGridResult.root.fields, "Objects Section");
        const exitElevation0 = findGroupByName(exitObjectsSection.fields, "Elevation 0 Objects");
        const exitObject = exitElevation0.fields.find((field) =>
            field && typeof field === "object" && "fields" in field &&
            (field as { fields: unknown[] }).fields.some((child) =>
                child && typeof child === "object" && "name" in child && child.name === "Exit Grid"
            )
        ) as { fields: unknown[] } | undefined;

        expect(exitObject).toBeDefined();
        const exitGrid = findGroupByName(exitObject!.fields, "Exit Grid");
        expect(findFieldByName(exitGrid.fields, "Destination Elevation").type).toBe("enum");
        expect(findFieldByName(exitGrid.fields, "Destination Rotation").type).toBe("enum");
    });

    it("parses sfsheng.map without script overflow errors", () => {
        const mapData = loadMap(path.resolve("external/fallout/Fallout2_Restoration_Project/data/maps/sfsheng.map"));
        const result = mapParser.parse(mapData, { gracefulMapBoundaries: true });

        expect(result.errors).toBeUndefined();
        expect(result.root.fields.some((field) =>
            field && typeof field === "object" && "name" in field && field.name === "Objects Section"
        )).toBe(true);
    });

    it.each([
        "sfsheng.map",
    ])("falls back to an opaque object section for ambiguous %s boundaries", (fileName) => {
        const mapData = loadMap(path.resolve(`external/fallout/Fallout2_Restoration_Project/data/maps/${fileName}`));
        const result = mapParser.parse(mapData, { gracefulMapBoundaries: true });

        expect(result.errors).toBeUndefined();

        const objectsSection = findGroupByName(result.root.fields, "Objects Section");
        expect(findFieldByName(objectsSection.fields, "Total Objects").value).toBe(0);

        const elevation0 = findGroupByName(objectsSection.fields, "Elevation 0 Objects");
        expect(findFieldByName(elevation0.fields, "Object Count").value).toBe(0);

        const todoNote = objectsSection.fields.find((field) =>
            field && typeof field === "object" && "name" in field && field.name === "TODO"
        ) as { value: unknown } | undefined;
        expect(todoNote?.value).toContain("boundary");

        const firstObject = elevation0.fields.find((field) =>
            field && typeof field === "object" && "name" in field && /^Object \d+\.\d+ /.test(String(field.name))
        );
        expect(firstObject).toBeUndefined();
    });

    it.each([
        "sfsheng.map",
    ])("fails strict parsing for deterministic %s script parse errors", (fileName) => {
        const mapData = loadMap(path.resolve(`external/fallout/Fallout2_Restoration_Project/data/maps/${fileName}`));
        const result = mapParser.parse(mapData);

        expect(result.errors).toBeDefined();
        expect(result.errors?.some((error) => error.includes("overflow"))).toBe(true);
    });
});

describe("MAP parser - error cases", () => {
    it("rejects empty files", () => {
        const result = mapParser.parse(new Uint8Array(0));
        expect(result.errors).toBeDefined();
        expect(result.errors!.length).toBeGreaterThan(0);
    });

    it("rejects files smaller than header", () => {
        const result = mapParser.parse(new Uint8Array(100));
        expect(result.errors).toBeDefined();
        expect(result.errors![0]).toContain("too small");
    });
});
