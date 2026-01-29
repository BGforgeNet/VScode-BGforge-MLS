/**
 * Parses .h header files to extract #define constants, variables, procedures,
 * defines-with-args, and aliases. Each define is classified by its DefineKind
 * for use in syntax highlighting.
 */

import fs from "node:fs";
import path from "node:path";
import type { DefineKind } from "./types.js";

/** Matches: #define NAME (value) or #define NAME value — numeric constants */
const REGEX_CONSTANT = /^#define\s+(\w+)\s+\(?([0-9]+)\)?/;

/** Names that are already proper constants (UPPER_CASE) — skip from constant category */
const REGEX_CONSTANT_REAL = /^([A-Z][A-Z0-9]*(_[\w]+)?)$/;

/** Matches: #define NAME(args) — defines with arguments */
const REGEX_DEFINE_WITH_ARGS = /^#define\s+(\w+)\([\w\s,]+\)/;

// TODO: this regex only matches argless procedures. The optional arg group never
// matches because [\w+] is a character class (not \w+), and the group structure
// doesn't account for the actual syntax. Fix to match `procedure foo(variable x) begin`.
const REGEX_PROCEDURE = /^procedure\s+(\w+)(\((variable\s+[\w+])(\s*,\s*variable\s+[\w+])?\))?\s+begin/;

/** Matches: #define (GVAR|MVAR|LVAR)_NAME (value) — game variables */
const REGEX_VARIABLE = /^#define\s+((GVAR|MVAR|LVAR)_\w+)\s+\(?([0-9]+)\)?/;

/** Matches: #define NAME (OTHER_NAME) — aliases */
const REGEX_ALIAS = /^#define\s+(\w+)\s+\(?\w+\)?\s*$/;

/**
 * Extracts all defines from a single .h file, classifying each by DefineKind.
 * The regex matching order matters: variables are checked before constants
 * (since GVAR/MVAR/LVAR defines would also match the constant regex).
 */
export function definesFromFile(filePath: string): ReadonlyMap<string, DefineKind> {
    const content = fs.readFileSync(filePath, "utf8");
    const defines = new Map<string, DefineKind>();

    for (const line of content.split("\n")) {
        const variable = REGEX_VARIABLE.exec(line);
        if (variable) {
            const defname = variable[1]!;
            defines.set(defname, "variable");
            continue;
        }

        const constant = REGEX_CONSTANT.exec(line);
        if (constant) {
            const defname = constant[1]!;
            if (!REGEX_CONSTANT_REAL.test(defname)) {
                defines.set(defname, "constant");
            }
            continue;
        }

        const defineWithVars = REGEX_DEFINE_WITH_ARGS.exec(line);
        if (defineWithVars) {
            const defname = defineWithVars[1]!;
            defines.set(defname, "define_with_vars");
            continue;
        }

        const alias = REGEX_ALIAS.exec(line);
        if (alias) {
            const defname = alias[1]!;
            if (!REGEX_CONSTANT_REAL.test(defname)) {
                defines.set(defname, "alias");
            }
            continue;
        }

        const procedure = REGEX_PROCEDURE.exec(line);
        if (procedure) {
            const defname = procedure[1]!;
            defines.set(defname, "procedure");
            continue;
        }
    }

    return defines;
}

/**
 * Byte-level string comparison matching Python's default sort order.
 * Unlike localeCompare, this sorts by character code (e.g. '_' after 'Z').
 */
export function cmpStr(a: string, b: string): number {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
}

/**
 * Recursively walks a directory, returning files matching the given extension.
 * Sorts entries alphabetically for deterministic cross-platform ordering.
 */
export function findFiles(dirPath: string, ext: string): readonly string[] {
    const results: string[] = [];
    const extLower = `.${ext.toLowerCase()}`;

    function walk(dir: string): void {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        entries.sort((a, b) => cmpStr(a.name, b.name));
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (entry.isFile()) {
                const fileExt = path.extname(entry.name).toLowerCase();
                if (fileExt === extLower) {
                    results.push(fullPath);
                }
            }
        }
    }

    walk(dirPath);
    return results;
}

/**
 * Finds a single file by name recursively under the given path.
 * Returns the full path or undefined if not found.
 */
export function findFile(dirPath: string, filename: string): string | undefined {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    entries.sort((a, b) => cmpStr(a.name, b.name));
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isFile() && entry.name === filename) {
            return fullPath;
        }
        if (entry.isDirectory()) {
            const found = findFile(fullPath, filename);
            if (found !== undefined) {
                return found;
            }
        }
    }
    return undefined;
}

/**
 * Collects defines from all .h files in a directory tree.
 * Later files override earlier ones (last-writer-wins via Map).
 * Returns entries sorted alphabetically by name for deterministic output.
 */
export function collectDefines(srcDir: string): ReadonlyMap<string, DefineKind> {
    const headerFiles = findFiles(srcDir, "h");
    const merged = new Map<string, DefineKind>();

    for (const filePath of headerFiles) {
        const fileDefines = definesFromFile(filePath);
        for (const [name, kind] of fileDefines) {
            merged.set(name, kind);
        }
    }

    // Sort alphabetically for deterministic output
    const sorted = new Map(
        [...merged.entries()].sort(([a], [b]) => cmpStr(a, b))
    );
    return sorted;
}
