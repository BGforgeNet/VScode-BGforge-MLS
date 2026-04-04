/**
 * Fallout SSL JSDoc type metadata: display details for completion.
 *
 * Type NAME list is in jsdoc-types.ts (FALLOUT_JSDOC_TYPE_NAMES). Keys here must match.
 * SYNC: jsdoc-types.ts (canonical type name list, validated by type-sync.test.ts)
 */

interface FalloutType {
    readonly detail: string;
}

/** All known Fallout SSL JSDoc types with their display details. */
export const FALLOUT_JSDOC_TYPES: ReadonlyMap<string, FalloutType> = new Map([
    ["array", { detail: "Array type" }],
    ["any", { detail: "Any type" }],
    ["bit", { detail: "Bit type" }],
    ["bool", { detail: "Boolean type" }],
    ["float", { detail: "Floating point type" }],
    ["int", { detail: "Integer type" }],
    ["list", { detail: "List type" }],
    ["map", { detail: "Map type" }],
    ["mixed", { detail: "Mixed type (int or float)" }],
    ["ObjectPtr", { detail: "Object pointer" }],
    ["string", { detail: "String type" }],
]);
