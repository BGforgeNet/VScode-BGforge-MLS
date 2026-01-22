/**
 * JSDoc comment parser.
 * Extracts @param, @return, @deprecated tags from documentation comments.
 *
 * Supported types: array, bool, ids, int, list, map, resref, string, filename
 */

// ============================================
// Types
// ============================================

/** Parsed parameter info. */
export interface Arg {
    name: string;
    type: string;
    default?: string;
    description?: string;
    required?: boolean; // True if name ends with ! (e.g., @param {int} count!)
}

/** Parsed return type info. */
export interface Ret {
    type: string;
}

/** Complete parsed JSDoc. */
export interface JSdoc {
    desc?: string;
    args: Arg[];
    ret?: Ret;
    deprecated?: string | true;
    type?: string; // For @type tag (used for variables)
}

// ============================================
// Regex patterns
// ============================================

/**
 * Pattern for @param/@arg tags.
 * Matches: @param {type} name - description
 *      or: @param {type} name! - description (required)
 *      or: @param {type} [name=default] - description
 *
 * Groups: 1=type, 2=simpleName, 3=requiredMarker(!), 4=bracketName, 5=default, 6=description
 */
const PARAM_PATTERN = /@(?:arg|param)\s+\{(\w+)\}\s+(?:(\w+)(!)?|\[(\w+)=([^\]]+)\])(?:\s+-\s+|\s+)?(.+)?/;

/** Pattern for @return/@returns/@ret tags. Groups: 1=type */
const RETURN_PATTERN = /@(?:ret|return|returns)\s+\{(\w+)\}/;

/** Pattern for @deprecated tag. Groups: 1=message (optional) */
const DEPRECATED_PATTERN = /@deprecated(?:\s+(.*))?/;

/** Pattern for @type tag. Groups: 1=type */
const TYPE_PATTERN = /@type\s+\{(\w+)\}/;

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

    // Remove first line (/**) and last line (*/)
    lines.shift();
    lines.pop();

    const args: Arg[] = [];
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

        // Try parsing @return
        const returnResult = parseReturn(line);
        if (returnResult) {
            ret = returnResult;
            continue;
        }

        // Try parsing @type
        const typeResult = parseType(line);
        if (typeResult) {
            type = typeResult;
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
    if (type) {
        result.type = type;
    }
    if (deprecated !== undefined) {
        result.deprecated = deprecated;
    }

    return result;
}

/** Parse @param or @arg tag. */
function parseParam(line: string): Arg | null {
    const match = line.match(PARAM_PATTERN);
    if (!match) {
        return null;
    }

    const [, type, simpleName, requiredMarker, bracketName, defaultValue, description] = match;
    const name = simpleName || bracketName;

    // Type and name are required
    if (!type || !name) {
        return null;
    }

    const arg: Arg = { name, type };

    if (requiredMarker === "!") {
        arg.required = true;
    }
    if (defaultValue) {
        arg.default = defaultValue;
    }
    if (description) {
        arg.description = description;
    }

    return arg;
}

/** Parse @return, @returns, or @ret tag. */
function parseReturn(line: string): Ret | null {
    const match = line.match(RETURN_PATTERN);
    if (!match || !match[1]) {
        return null;
    }
    return { type: match[1] };
}

/** Parse @type tag. Returns type string or null if no match. */
function parseType(line: string): string | null {
    const match = line.match(TYPE_PATTERN);
    if (!match || !match[1]) {
        return null;
    }
    return match[1];
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
 * Build a map of parameter names to their descriptions from JSDoc.
 * Returns empty map if jsdoc or args is undefined/empty.
 */
export function buildDescriptionMap(jsdoc?: JSdoc): Map<string, string> {
    const map = new Map<string, string>();
    if (!jsdoc?.args) {
        return map;
    }
    for (const arg of jsdoc.args) {
        if (arg.description) {
            map.set(arg.name, arg.description);
        }
    }
    return map;
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
