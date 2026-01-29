/**
 * Loads sfall functions.yml and hooks.yml, producing completion items
 * and highlight patterns for the Fallout SSL language support.
 */

import fs from "node:fs";
import YAML from "yaml";
import { cmpStr, findFile } from "./header-defines.js";
import type {
    FalloutCompletionItem,
    HighlightPattern,
    SfallCategory,
} from "./types.js";
import { validateArray, validateSfallCategory, validateSfallHook } from "./validate.js";

const FUNCTIONS_YAML = "functions.yml";
const HOOKS_YAML = "hooks.yml";

/**
 * Dedents text by removing common leading whitespace.
 * Equivalent to Python's textwrap.dedent(string).
 */
export function litscal(text: string): string {
    const lines = text.split("\n");
    const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
    if (nonEmptyLines.length === 0) {
        return text;
    }

    const minIndent = nonEmptyLines.reduce((min, line) => {
        const match = line.match(/^(\s*)/);
        const indent = match?.[1]?.length ?? 0;
        return Math.min(min, indent);
    }, Infinity);

    if (minIndent > 0 && minIndent < Infinity) {
        return lines.map((line) => line.slice(minIndent)).join("\n");
    }
    return text;
}

/** Result of loading sfall functions */
export interface SfallFunctionsResult {
    readonly completionItems: readonly FalloutCompletionItem[];
    readonly highlightPatterns: readonly HighlightPattern[];
}

/** Result of loading sfall hooks */
export interface SfallHooksResult {
    readonly completionItems: readonly FalloutCompletionItem[];
    readonly highlightPatterns: readonly HighlightPattern[];
}

/**
 * Builds a completion item from an sfall function, merging category-level
 * documentation into the function's doc field.
 */
function buildCompletionItem(
    func: SfallCategory["items"] extends readonly (infer T)[] | undefined ? T : never,
    categoryDoc: string,
): FalloutCompletionItem {
    let doc = func.doc ?? "";
    if (categoryDoc !== "") {
        doc = doc === "" ? categoryDoc : `${doc}\n${categoryDoc}`;
    }

    const item: FalloutCompletionItem = {
        name: func.name,
        ...(func.detail !== "" ? { detail: func.detail } : {}),
        ...(doc !== "" ? { doc: litscal(doc) } : {}),
        ...(func.args !== undefined ? { args: func.args, type: func.type } : {}),
    };
    return item;
}

/**
 * Loads sfall functions.yml, validates the data, and produces completion items
 * and highlight patterns. Categories and functions are sorted alphabetically
 * to minimize diff noise in the output files.
 */
export function loadSfallFunctions(srcDir: string): SfallFunctionsResult {
    const functionsPath = findFile(srcDir, FUNCTIONS_YAML);
    if (functionsPath === undefined) {
        throw new Error(`${FUNCTIONS_YAML} not found in ${srcDir}`);
    }

    const content = fs.readFileSync(functionsPath, "utf8");
    const raw = YAML.parse(content) as unknown;
    const categories = validateArray(raw, validateSfallCategory, "functions.yml");

    const sortedCategories = [...categories].sort((a, b) => cmpStr(a.name, b.name));

    const completionItems: FalloutCompletionItem[] = [];
    const highlightPatterns: HighlightPattern[] = [];

    for (const category of sortedCategories) {
        const categoryDoc = category.doc ?? "";

        if (category.items !== undefined) {
            const sortedFunctions = [...category.items].sort((a, b) => cmpStr(a.name, b.name));

            for (const func of sortedFunctions) {
                // Skip exponentiation operator from highlight
                if (func.name !== "^") {
                    highlightPatterns.push({ match: `\\b(?i)(${func.name})\\b` });
                }
                completionItems.push(buildCompletionItem(func, categoryDoc));
            }
        }
    }

    return { completionItems, highlightPatterns };
}

/**
 * Loads sfall hooks.yml, validates the data, and produces completion items
 * and highlight patterns. Hooks are sorted alphabetically and prefixed with
 * "HOOK_" in the output.
 */
export function loadSfallHooks(srcDir: string): SfallHooksResult {
    const hooksPath = findFile(srcDir, HOOKS_YAML);
    if (hooksPath === undefined) {
        throw new Error(`${HOOKS_YAML} not found in ${srcDir}`);
    }

    const content = fs.readFileSync(hooksPath, "utf8");
    const raw = YAML.parse(content) as unknown;
    const hooks = validateArray(raw, validateSfallHook, "hooks.yml");

    const sortedHooks = [...hooks].sort((a, b) => cmpStr(a.name, b.name));

    const completionItems: FalloutCompletionItem[] = [];
    const highlightPatterns: HighlightPattern[] = [];

    for (const hook of sortedHooks) {
        const codename = `HOOK_${hook.name.toUpperCase()}`;
        completionItems.push({
            name: codename,
            doc: litscal(hook.doc),
        });
        highlightPatterns.push({ match: `\\b(${codename})\\b` });
    }

    return { completionItems, highlightPatterns };
}
