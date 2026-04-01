/**
 * PRO file serializer: converts a ParseResult back to binary bytes.
 *
 * Strategy: walk the ParseResult field tree, write each field's raw value
 * to the output buffer at its declared offset and size. This avoids
 * reconstructing intermediate schema objects and works directly with
 * the field metadata that the parser already provides.
 *
 * For packed fields (objectTypeAndId, frmTypeAndId, scriptId, destTileAndElevation),
 * the original packed uint32 is reconstructed from the component fields.
 */

import { ParseResult, ParsedGroup, ParsedField } from "./types";

/**
 * Write a numeric value to a big-endian buffer at the given offset and size.
 */
function writeBE(buf: DataView, offset: number, size: number, value: number, signed: boolean): void {
    switch (size) {
        case 1:
            if (signed) buf.setInt8(offset, value);
            else buf.setUint8(offset, value);
            break;
        case 2:
            if (signed) buf.setInt16(offset, value, false);
            else buf.setUint16(offset, value, false);
            break;
        case 3:
            // 24-bit unsigned, big-endian
            buf.setUint8(offset, (value >> 16) & 0xff);
            buf.setUint8(offset + 1, (value >> 8) & 0xff);
            buf.setUint8(offset + 2, value & 0xff);
            break;
        case 4:
            if (signed) buf.setInt32(offset, value, false);
            else buf.setUint32(offset, value, false);
            break;
    }
}

/** Field names that are the first component of a packed uint32 */
const PACKED_FIRST_FIELDS = new Set([
    "Object Type", "FRM Type", "Script Type",
]);

/** Field names that are the second component of a packed uint32 */
const PACKED_SECOND_FIELDS = new Set([
    "Object ID", "FRM ID", "Script ID",
]);

/** Names of Dest Tile fields that pack with Dest Elevation into a single uint32 */
const DEST_TILE_FIELD = "Dest Tile";
const DEST_ELEVATION_FIELD = "Dest Elevation";

/**
 * Determine if a field type implies signed values
 */
function isSigned(type: string): boolean {
    return type === "int32" || type === "int16" || type === "int8" || type === "int24";
}

/** Gender display-to-raw mapping (fallback if rawValue missing) */
const GENDER_MAP: Record<string, number> = { "Male": 0, "Female": 1 };

/**
 * Get the numeric value to write for a field.
 * Uses rawValue for enums/flags (display string is not writable).
 * Uses value directly for numeric fields.
 * Handles special display formats: "30%" -> 30, "0x0000001f" -> 31.
 */
function numericValue(f: ParsedField): number {
    if (f.rawValue !== undefined && typeof f.rawValue === "number") {
        return f.rawValue;
    }
    if (typeof f.value === "number") {
        return f.value;
    }
    if (typeof f.value === "string") {
        // Hex string values like "0x00000000" from key codes and critter flagsExt
        if (f.value.startsWith("0x")) {
            const result = parseInt(f.value, 16);
            // Defensive: parseInt returns NaN for invalid hex strings (e.g., "0xZZZ").
            // NaN would propagate through arithmetic and corrupt binary output, so we return 0.
            return isNaN(result) ? 0 : result;
        }
        // Percent strings like "30%" from damage resistance fields
        if (f.value.endsWith("%")) {
            const result = parseInt(f.value, 10);
            return isNaN(result) ? 0 : result;
        }
        // Gender enum (fallback for legacy JSON without rawValue)
        if (f.value in GENDER_MAP) {
            return GENDER_MAP[f.value]!;
        }
    }
    return 0;
}

/**
 * Serialize a ParseResult back to PRO binary bytes.
 * Walks the field tree and writes each field at its declared offset.
 */
export function serializePro(result: ParseResult): Uint8Array {
    // Determine file size from the field tree: find the maximum (offset + size)
    let maxEnd = 0;
    visitFields(result.root, (f) => {
        const end = f.offset + f.size;
        if (end > maxEnd) maxEnd = end;
    });

    const buf = new ArrayBuffer(maxEnd);
    const view = new DataView(buf);

    // Write fields, handling packed fields specially
    writeGroup(view, result.root);

    return new Uint8Array(buf);
}

/**
 * Visit all ParsedFields in a group tree
 */
function visitFields(group: ParsedGroup, fn: (f: ParsedField) => void): void {
    for (const entry of group.fields) {
        if ("fields" in entry) {
            visitFields(entry, fn);
        } else {
            fn(entry);
        }
    }
}

/**
 * Write all fields in a group, handling packed field pairs.
 */
function writeGroup(view: DataView, group: ParsedGroup): void {
    const fields = flattenFields(group);

    for (let i = 0; i < fields.length; i++) {
        const f = fields[i]!;
        const next: ParsedField | undefined = fields[i + 1];

        // Handle packed pairs: Type (1 byte) + ID (3 bytes) -> one uint32
        if (PACKED_FIRST_FIELDS.has(f.name) && next && PACKED_SECOND_FIELDS.has(next.name)) {
            const typeVal = numericValue(f);
            const idVal = numericValue(next);
            const packed = ((typeVal & 0xff) << 24) | (idVal & 0x00ffffff);
            writeBE(view, f.offset, 4, packed, false);
            i++; // skip the ID field, already written
            continue;
        }

        // Handle packed Dest Tile + Dest Elevation -> one uint32
        if (f.name === DEST_TILE_FIELD && next && next.name === DEST_ELEVATION_FIELD) {
            const tile = numericValue(f);
            const elev = numericValue(next);
            const packed = ((elev & 0x3f) << 26) | (tile & 0x3ffffff);
            writeBE(view, f.offset, 4, packed, false);
            i++; // skip elevation field
            continue;
        }

        // Skip second components if encountered out of order (shouldn't happen)
        if (PACKED_SECOND_FIELDS.has(f.name) || f.name === DEST_ELEVATION_FIELD) {
            continue;
        }

        // Regular field
        writeBE(view, f.offset, f.size, numericValue(f), isSigned(f.type));
    }
}

/**
 * Flatten all fields from a group tree into a sequential array,
 * preserving the order they appear in the tree.
 */
function flattenFields(group: ParsedGroup): ParsedField[] {
    const result: ParsedField[] = [];
    for (const entry of group.fields) {
        if ("fields" in entry) {
            result.push(...flattenFields(entry));
        } else {
            result.push(entry);
        }
    }
    return result;
}
