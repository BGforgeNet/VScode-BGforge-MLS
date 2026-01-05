/**
 * Centralized regex patterns for translation references.
 * Single source of truth for all translation-related patterns.
 */

// =============================================================================
// MSG patterns (Fallout SSL, TSSL)
// Matches: mstr(123), NOption(123), display_mstr(123), etc.
// =============================================================================

/** MSG function names that take a translation reference as first argument */
const MSG_FUNCTIONS = [
    "Reply",
    "NOption",
    "GOption",
    "BOption",
    "mstr",
    "display_mstr",
    "floater",
    "NLowOption",
    "BLowOption",
    "GLowOption",
    "GMessage",
    "NMessage",
    "BMessage",
    "CompOption",
] as const;

const msgFunctionsPattern = MSG_FUNCTIONS.join("|");

/** Matches MSG reference for hover detection: "mstr(123" or "NOption(123" */
export const REGEX_MSG_HOVER = new RegExp(`^(${msgFunctionsPattern})\\((\\d+)$`);

/** Matches MSG reference in text for inlay hints (global) */
export const REGEX_MSG_INLAY = new RegExp(`(${msgFunctionsPattern})\\((\\d+)`, "g");

// =============================================================================
// TRA patterns (WeiDU: baf, d, tp2, etc.)
// Matches: @123
// =============================================================================

/** Matches TRA reference for hover detection: "@123" */
export const REGEX_TRA_HOVER = /^@[0-9]+$/;

/** Matches TRA reference in text for inlay hints (global) */
export const REGEX_TRA_INLAY = /@(\d+)/g;

// =============================================================================
// TBAF patterns (TypeScript BAF)
// Matches: $tra(123)
// =============================================================================

/** Matches TBAF reference for hover detection: "$tra(123)" */
export const REGEX_TBAF_HOVER = /^\$tra\((\d+)\)$/;

/** Matches TBAF reference in text for inlay hints (global) */
export const REGEX_TBAF_INLAY = /\$tra\((\d+)\)/g;

/** Replacement pattern for TBAF transpiler: $tra(123) => @123 */
export const REGEX_TBAF_REPLACE = /\$tra\((\d+)\)/g;

// =============================================================================
// @tra comment pattern
// Matches: /** @tra filename.msg */ or /** @tra filename.tra */
// =============================================================================

/** Extracts full filename from @tra comment: "/** @tra test.msg *‌/" => "test.msg" */
export const REGEX_TRA_COMMENT = /^\/\*\* @tra ((\w+)\.(tra|msg)) \*\//;

/** Extracts just the extension from @tra comment: "/** @tra test.msg *‌/" => "msg" */
export const REGEX_TRA_COMMENT_EXT = /^\/\*\* @tra \w+\.(tra|msg) \*\//;
