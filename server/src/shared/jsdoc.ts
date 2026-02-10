/**
 * JSDoc comment parser.
 * Extracts @param, @return, @deprecated, @type tags from documentation comments.
 *
 * Supported types: array, bool, ids, int, list, map, resref, string, filename
 *
 * Supported tags:
 *   @param {type} name - description        Basic parameter
 *   @param {type} name! - description       Required parameter (hides default in hover)
 *   @param {type} [name=default] - desc     Parsed but default is ignored (see note)
 *   @return {type}                          Unnamed return (Fallout SSL procedures)
 *   @return name {type} - description       Named return (WeiDU RET/RET_ARRAY vars)
 *   @deprecated                             Mark as deprecated
 *   @deprecated message                     Deprecated with reason
 *   @type {type}                            Variable type annotation
 *
 * Note on defaults:
 *   The [name=default] syntax is parsed for compatibility but the default value is ignored.
 *   Both WeiDU and Fallout SSL get defaults from the AST, so JSDoc defaults are redundant.
 *   Use @param {type} name - description instead.
 */

// ============================================
// Types
// ============================================

/** Parsed parameter info. */
export interface Arg {
    name: string;
    type: string;
    description?: string;
    required?: boolean; // True if name ends with ! (e.g., @param {int} count!)
}

/** Parsed return type info. */
export interface Ret {
    name?: string;        // For named returns (@return x {int})
    type: string;
    description?: string;
}

/** Complete parsed JSDoc. */
export interface JSdoc {
    desc?: string;
    args: Arg[];
    ret?: Ret;      // Unnamed @return {type} (backwards compat)
    rets?: Ret[];   // Named returns: @return name {type} desc
    deprecated?: string | true;
    type?: string; // For @type tag (used for variables)
}

// ============================================
// Regex patterns
// ============================================

import { JSDOC_TYPE_PATTERN } from "./jsdoc-types";

/**
 * Pattern for @param/@arg tags with braces.
 * Matches: @param {type} name - description
 *      or: @param {type} name! - description (required)
 *      or: @param {type} [name=default] - description
 *
 * Groups: 1=type, 2=simpleName, 3=requiredMarker(!), 4=bracketName, 5=default, 6=description
 */
const PARAM_PATTERN = /@(?:arg|param)\s+\{(\w+)\}\s+(?:(\w+)(!)?|\[(\w+)=([^\]]+)\])(?:\s+-\s+|\s+)?(.+)?/;

/**
 * Pattern for @param/@arg tags without braces (type must be a known JSDoc type).
 * Matches: @param type name - description
 *      or: @param type name! - description (required)
 *
 * Groups: 1=type, 2=name, 3=requiredMarker(!), 4=description
 */
const PARAM_BRACELESS_PATTERN = new RegExp(
    `@(?:arg|param)\\s+(${JSDOC_TYPE_PATTERN})\\s+(\\w+)(!)?(?:\\s+-\\s+|\\s+)?(.+)?`
);

/** Pattern for unnamed @return/@returns/@ret tags with braces. Groups: 1=type, 2=description (optional) */
const RETURN_PATTERN = /@(?:ret|return|returns)\s+\{(\w+)\}(?:\s+-\s+|\s+)?(.+)?/;

/**
 * Pattern for unnamed @return/@returns/@ret tags without braces (type must be a known JSDoc type).
 * Groups: 1=type, 2=description (optional)
 */
const RETURN_BRACELESS_PATTERN = new RegExp(
    `@(?:ret|return|returns)\\s+(${JSDOC_TYPE_PATTERN})\\b(?:\\s+-\\s+|\\s+)?(.+)?`
);

/**
 * Pattern for named @return/@returns/@ret tags with braces.
 * Matches: @return name {type} - description
 *      or: @return name {type} description
 * Groups: 1=name, 2=type, 3=description (optional)
 */
const NAMED_RETURN_PATTERN = /@(?:ret|return|returns)\s+(\w+)\s+\{(\w+)\}(?:\s+-\s+|\s+)?(.+)?/;

/**
 * Pattern for named @return/@returns/@ret tags without braces (type must be a known JSDoc type).
 * Matches: @return name type - description
 * Groups: 1=name, 2=type, 3=description (optional)
 */
const NAMED_RETURN_BRACELESS_PATTERN = new RegExp(
    `@(?:ret|return|returns)\\s+(\\w+)\\s+(${JSDOC_TYPE_PATTERN})\\b(?:\\s+-\\s+|\\s+)?(.+)?`
);

/** Pattern for @deprecated tag. Groups: 1=message (optional) */
const DEPRECATED_PATTERN = /@deprecated(?:\s+(.*))?/;

/** Pattern for @type tag. Groups: 1=type with braces, 2=type without braces, 3=trailing description */
const TYPE_PATTERN = /@type\s+(?:\{(\w+)\}|(\w+))(?:\s+-\s+|\s+)?(.+)?/;

/** Pattern for JSDoc line prefix " * " or " *" */
const LINE_PREFIX_PATTERN = /^\s*\*\s?/;

// ============================================
// Parsing functions
// ============================================

/**
 * Parse a JSDoc comment block.
 * @param text Raw comment text including / * * and * /
 */
export function parse(text: string): JSdoc {
    const lines = text.split("\n");

    if (lines.length === 1) {
        // Single-line JSDoc: /** content */
        const content = text.replace(/^\/\*\*\s*/, "").replace(/\s*\*\/$/, "").trim();
        lines.length = 0;
        if (content) {
            lines.push(content);
        }
    } else {
        // Multi-line: remove first (/**) and last (*/) lines
        lines.shift();
        lines.pop();
    }

    const args: Arg[] = [];
    const rets: Ret[] = [];
    const descriptionLines: string[] = [];
    let ret: Ret | undefined;
    let deprecated: string | true | undefined;
    let type: string | undefined;

    for (const rawLine of lines) {
        const line = rawLine.replace(LINE_PREFIX_PATTERN, "");

        // Skip empty lines in description collection
        if (!line.startsWith("@")) {
            descriptionLines.push(line);
            continue;
        }

        // Try parsing @param
        const paramResult = parseParam(line);
        if (paramResult) {
            args.push(paramResult);
            continue;
        }

        // Try parsing named @return (e.g., @return name {type} desc)
        const namedReturnResult = parseNamedReturn(line);
        if (namedReturnResult) {
            rets.push(namedReturnResult);
            continue;
        }

        // Try parsing unnamed @return (e.g., @return {type})
        const returnResult = parseReturn(line);
        if (returnResult) {
            ret = returnResult;
            continue;
        }

        // Try parsing @type (may include trailing description)
        const typeResult = parseType(line);
        if (typeResult) {
            type = typeResult.type;
            if (typeResult.desc) {
                descriptionLines.push(typeResult.desc);
            }
            continue;
        }

        // Try parsing @deprecated
        const deprecatedResult = parseDeprecated(line);
        if (deprecatedResult !== null) {
            deprecated = deprecatedResult;
        }
    }

    // Build result
    const result: JSdoc = { args };
    const desc = descriptionLines.join("\n").trim();
    if (desc) {
        result.desc = desc;
    }
    if (ret) {
        result.ret = ret;
    }
    if (rets.length > 0) {
        result.rets = rets;
    }
    if (type) {
        result.type = type;
    }
    if (deprecated !== undefined) {
        result.deprecated = deprecated;
    }

    return result;
}

/** Parse @param or @arg tag (with or without braces around type). */
function parseParam(line: string): Arg | null {
    // Try braced syntax first: @param {type} name
    const match = line.match(PARAM_PATTERN);
    if (match) {
        // Note: defaultValue (group 5) is parsed but ignored - defaults come from AST
        const [, type, simpleName, requiredMarker, bracketName, , description] = match;
        const name = simpleName || bracketName;

        // Type and name are required
        if (!type || !name) {
            return null;
        }

        const arg: Arg = { name, type };
        if (requiredMarker === "!") {
            arg.required = true;
        }
        if (description) {
            arg.description = description;
        }
        return arg;
    }

    // Try brace-less syntax: @param type name (type must be a known JSDoc type)
    const bracelessMatch = line.match(PARAM_BRACELESS_PATTERN);
    if (!bracelessMatch) {
        return null;
    }

    const [, type, name, requiredMarker, description] = bracelessMatch;
    if (!type || !name) {
        return null;
    }

    const arg: Arg = { name, type };
    if (requiredMarker === "!") {
        arg.required = true;
    }
    if (description) {
        arg.description = description;
    }
    return arg;
}

/** Parse unnamed @return, @returns, or @ret tag (with or without braces). */
function parseReturn(line: string): Ret | null {
    // Try braced syntax first: @ret {type}
    const match = line.match(RETURN_PATTERN);
    if (match && match[1]) {
        const ret: Ret = { type: match[1] };
        if (match[2]) {
            ret.description = match[2].trim();
        }
        return ret;
    }

    // Try brace-less syntax: @ret type (type must be a known JSDoc type)
    const bracelessMatch = line.match(RETURN_BRACELESS_PATTERN);
    if (!bracelessMatch || !bracelessMatch[1]) {
        return null;
    }
    const ret: Ret = { type: bracelessMatch[1] };
    if (bracelessMatch[2]) {
        ret.description = bracelessMatch[2].trim();
    }
    return ret;
}

/**
 * Parse named @return, @returns, or @ret tag (with or without braces).
 * Format: @return name {type} - description
 *     or: @return name type - description (type must be a known JSDoc type)
 */
function parseNamedReturn(line: string): Ret | null {
    // Try braced syntax first: @ret name {type}
    const match = line.match(NAMED_RETURN_PATTERN);
    if (match && match[1] && match[2]) {
        const ret: Ret = { name: match[1], type: match[2] };
        if (match[3]) {
            ret.description = match[3].trim();
        }
        return ret;
    }

    // Try brace-less syntax: @ret name type (type must be a known JSDoc type)
    const bracelessMatch = line.match(NAMED_RETURN_BRACELESS_PATTERN);
    if (!bracelessMatch || !bracelessMatch[1] || !bracelessMatch[2]) {
        return null;
    }
    const ret: Ret = { name: bracelessMatch[1], type: bracelessMatch[2] };
    if (bracelessMatch[3]) {
        ret.description = bracelessMatch[3].trim();
    }
    return ret;
}

/** Parse @type tag. Returns type and optional trailing description, or null if no match. */
function parseType(line: string): { type: string; desc?: string } | null {
    const match = line.match(TYPE_PATTERN);
    if (!match) {
        return null;
    }
    const type = match[1] || match[2];
    if (!type) {
        return null;
    }
    const desc = match[3]?.trim();
    return { type, desc: desc || undefined };
}

/** Parse @deprecated tag. Returns true if no message, string if message, null if no match. */
function parseDeprecated(line: string): string | true | null {
    const match = line.match(DEPRECATED_PATTERN);
    if (!match) {
        return null;
    }
    const message = match[1]?.trim();
    return message || true;
}

// ============================================
// Utility functions
// ============================================

/** Parameter info from JSDoc for display purposes. */
export interface ParamDisplayInfo {
    description?: string;
    required?: boolean;
}


/**
 * Build a map of parameter names to their display info (description, required) from JSDoc.
 * Returns empty map if jsdoc or args is undefined/empty.
 */
export function buildParamInfoMap(jsdoc?: JSdoc): Map<string, ParamDisplayInfo> {
    const map = new Map<string, ParamDisplayInfo>();
    if (!jsdoc?.args) {
        return map;
    }
    for (const arg of jsdoc.args) {
        const info: ParamDisplayInfo = {};
        if (arg.description) {
            info.description = arg.description;
        }
        if (arg.required) {
            info.required = true;
        }
        if (info.description || info.required) {
            map.set(arg.name, info);
        }
    }
    return map;
}
