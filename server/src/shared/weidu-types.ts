/**
 * WeiDU JSDoc type metadata: display details and INT_VAR/STR_VAR classification.
 *
 * Type NAME list is in jsdoc-types.ts (WEIDU_JSDOC_TYPE_NAMES). Keys here must match.
 * SYNC: jsdoc-types.ts (canonical type name list, validated by type-sync.test.ts)
 */

/** INT_VAR or STR_VAR classification for WeiDU function parameters. */
export type VarCategory = "int" | "str";

interface WeiduType {
    readonly detail: string;
    readonly category: VarCategory;
}

/** All known WeiDU JSDoc types with their display detail and variable category. */
export const WEIDU_JSDOC_TYPES: ReadonlyMap<string, WeiduType> = new Map([
    ["array", { detail: "Array type", category: "int" }],
    ["bool", { detail: "Boolean type", category: "int" }],
    ["filename", { detail: "File name", category: "str" }],
    ["ids", { detail: "IDS reference", category: "str" }],
    ["int", { detail: "Integer type", category: "int" }],
    ["list", { detail: "List type", category: "int" }],
    ["map", { detail: "Map type", category: "int" }],
    ["resref", { detail: "Resource reference", category: "str" }],
    ["string", { detail: "String type", category: "str" }],
]);

/** Base URL for type documentation on ielib.bgforge.net. */
const IELIB_TYPES_URL = "https://ielib.bgforge.net/types/#";

/** Format a type name as a markdown link if it's a known WeiDU type, plain text otherwise. */
export function formatTypeLink(type: string): string {
    if (!type) return "";
    return WEIDU_JSDOC_TYPES.has(type)
        ? `[${type}](${IELIB_TYPES_URL}${type})`
        : type;
}
