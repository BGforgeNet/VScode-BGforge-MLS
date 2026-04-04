/**
 * MAP file serializer: converts a ParseResult back to binary bytes.
 *
 * Strategy: walk the ParseResult field tree, write each field's raw value
 * to the output buffer at its declared offset and size.
 */

import { ParseOpaqueRange, ParseResult, ParsedGroup, ParsedField } from "./types";
import { HEADER_SIZE } from "./map-schemas";
import { decodeOpaqueRange } from "./opaque-range";

type MapParseResult = ParseResult & {
    __sourceData?: Uint8Array;
};

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
        case 4:
            if (signed) buf.setInt32(offset, value, false);
            else buf.setUint32(offset, value, false);
            break;
    }
}

function isSigned(type: string): boolean {
    return type === "int32" || type === "int16" || type === "int8";
}

function numericValue(f: ParsedField): number {
    if (f.rawValue !== undefined && typeof f.rawValue === "number") {
        return f.rawValue;
    }
    if (typeof f.value === "number") {
        return f.value;
    }
    if (typeof f.value === "string") {
        if (f.value.startsWith("0x")) {
            return parseInt(f.value, 16);
        }
    }
    return 0;
}

export function serializeMap(result: ParseResult): Uint8Array {
    let maxEnd = 0;
    visitFields(result.root, (f) => {
        const end = f.offset + f.size;
        if (end > maxEnd) maxEnd = end;
    });
    for (const opaqueRange of result.opaqueRanges ?? []) {
        const end = opaqueRange.offset + opaqueRange.size;
        if (end > maxEnd) maxEnd = end;
    }

    if (maxEnd < HEADER_SIZE) {
        maxEnd = HEADER_SIZE;
    }

    const sourceData = (result as MapParseResult).__sourceData;
    const initialSize = Math.max(maxEnd, sourceData?.length ?? 0);
    const buf = new ArrayBuffer(initialSize);
    const bytes = new Uint8Array(buf);
    if (sourceData) {
        bytes.set(sourceData.subarray(0, initialSize));
    }
    const view = new DataView(buf);

    writeOpaqueRanges(bytes, result.opaqueRanges);
    writeGroup(view, result.root, sourceData);

    return bytes;
}

function writeOpaqueRanges(target: Uint8Array, opaqueRanges?: ParseOpaqueRange[]): void {
    for (const opaqueRange of opaqueRanges ?? []) {
        const bytes = decodeOpaqueRange(opaqueRange);
        target.set(bytes, opaqueRange.offset);
    }
}

function visitFields(group: ParsedGroup, fn: (f: ParsedField) => void): void {
    const stack: ParsedGroup[] = [group];

    while (stack.length > 0) {
        const current = stack.pop()!;
        for (const entry of [...current.fields].reverse()) {
            if ("fields" in entry) {
                stack.push(entry);
            } else {
                fn(entry);
            }
        }
    }
}

function decodeFixedString(bytes: Uint8Array, offset: number, size: number): string {
    const fieldBytes = bytes.subarray(offset, offset + size);
    const terminator = fieldBytes.indexOf(0);
    const end = terminator === -1 ? fieldBytes.length : terminator;
    return new TextDecoder().decode(fieldBytes.subarray(0, end));
}

function writeGroup(view: DataView, group: ParsedGroup, sourceData?: Uint8Array): void {
    const fields = flattenFields(group);
    const packedTileWords = new Map<number, number>();

    for (const f of fields) {
        if (f.name === "Objects Data Size") {
            continue;
        }

        const packedTileField = getPackedTileField(f);
        if (packedTileField) {
            const currentWord = packedTileWords.get(packedTileField.wordOffset) ?? view.getUint32(packedTileField.wordOffset, false);
            packedTileWords.set(
                packedTileField.wordOffset,
                applyPackedTileField(currentWord, packedTileField.kind, numericValue(f))
            );
            continue;
        }

        if (f.name === "Filename") {
            const str = f.value as string;
            if (sourceData && decodeFixedString(sourceData, f.offset, f.size) === str) {
                continue;
            }
            const bytes = new TextEncoder().encode(str);
            for (let i = 0; i < Math.min(bytes.length, f.size); i++) {
                view.setUint8(f.offset + i, bytes[i] ?? 0);
            }
            for (let i = bytes.length; i < f.size; i++) {
                view.setUint8(f.offset + i, 0);
            }
            continue;
        }

        writeBE(view, f.offset, f.size, numericValue(f), isSigned(f.type));
    }

    for (const [offset, word] of packedTileWords) {
        view.setUint32(offset, word, false);
    }
}

function flattenFields(group: ParsedGroup): ParsedField[] {
    const result: ParsedField[] = [];
    visitFields(group, (field) => result.push(field));
    return result;
}

type PackedTileFieldKind = "floorTileId" | "floorFlags" | "roofTileId" | "roofFlags";

function getPackedTileField(field: ParsedField): { wordOffset: number; kind: PackedTileFieldKind } | undefined {
    if (!field.name.startsWith("Tile ")) {
        return undefined;
    }

    if (field.name.endsWith(" Floor")) {
        return { wordOffset: field.offset & ~0x3, kind: "floorTileId" };
    }
    if (field.name.endsWith(" Floor Flags")) {
        return { wordOffset: field.offset & ~0x3, kind: "floorFlags" };
    }
    if (field.name.endsWith(" Roof")) {
        return { wordOffset: field.offset & ~0x3, kind: "roofTileId" };
    }
    if (field.name.endsWith(" Roof Flags")) {
        return { wordOffset: field.offset & ~0x3, kind: "roofFlags" };
    }

    return undefined;
}

function applyPackedTileField(word: number, kind: PackedTileFieldKind, value: number): number {
    switch (kind) {
        case "floorTileId":
            return (word & ~0x0000_0FFF) | (value & 0x0FFF);
        case "floorFlags":
            return (word & ~0x0000_F000) | ((value & 0x0F) << 12);
        case "roofTileId":
            return (word & ~0x0FFF_0000) | ((value & 0x0FFF) << 16);
        case "roofFlags":
            return (word & ~0xF000_0000) | ((value & 0x0F) << 28);
    }
}
