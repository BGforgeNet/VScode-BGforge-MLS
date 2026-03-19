/**
 * IElib data update script.
 * Extracts constants, structure offsets, opcodes, and function definitions
 * from IElib header files and generates IDE completion/highlight YAML files.
 */

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import YAML from "yaml";
import {
    cmpStr,
    COMPLETION_TYPE_FUNCTION,
    dumpHighlight,
    findFiles,
    litscal,
    validateArray,
    validateFuncData,
    validateTypeEntry,
} from "./ie/index.js";
import type {
    CompletionItem,
    FuncData,
    FuncParam,
    IEData,
    TypeEntry,
} from "./ie/index.js";

/** IElib documentation base URL */
const IELIB_URL = "https://ielib.bgforge.net";
const TYPES_URL = `${IELIB_URL}/types`;

/** Regex for numeric constant defines: OUTER_SET NAME = value (or bare NAME = value) */
const REGEX_NUMERIC = /^(?:OUTER_SET\s+)?(\w+)\s*=\s*(\w+)/;
/** Regex for text sprint defines: OUTER_SPRINT/TEXT_SPRINT ~NAME~ ~value~ */
const REGEX_TEXT = /^(?:OUTER_SPRINT|TEXT_SPRINT)\s+~?(\w+)~?\s+~(\w+)~/;

/**
 * Offset types that map to their own stanza category.
 * Everything else (char array, byte array, bytes, etc.) goes to "other".
 */
const OFFSET_TYPES = ["char", "byte", "word", "dword", "resref", "strref"] as const;
type OffsetType = (typeof OFFSET_TYPES)[number];

/** A parsed define with JSDoc type and description */
interface TypedDefine {
    readonly name: string;
    readonly value: string;
    readonly type: OffsetType | "other";
    readonly doc: string;
}

/**
 * Extracts defines from a file matching a given regex pattern.
 * Returns a map of name -> value for all matching lines.
 */
function definesFromFile(filePath: string, regex: RegExp): ReadonlyMap<string, string> {
    const content = fs.readFileSync(filePath, "utf8");
    const defines = new Map<string, string>();
    for (const line of content.split("\n")) {
        const match = line.match(regex);
        if (match !== null) {
            // Safe: regex groups 1 and 2 always exist when the match succeeds
            defines.set(match[1]!, match[2]!);
        }
    }
    return defines;
}

/**
 * Parses a .tph file with JSDoc comments preceding OUTER_SET defines.
 * Extracts @type tag for categorization and remaining JSDoc body as description.
 *
 * Expected format:
 *   /** @type word
 *    * Description text
 *    *\/
 *   OUTER_SET NAME = 0xNN
 */
function typedDefinesFromFile(filePath: string): readonly TypedDefine[] {
    const content = fs.readFileSync(filePath, "utf8");
    const results: TypedDefine[] = [];

    // Match JSDoc block followed by OUTER_SET line
    const pattern = /\/\*\*([\s\S]*?)\*\/\s*\n\s*OUTER_SET\s+(\w+)\s*=\s*(\w+)/g;
    for (const match of content.matchAll(pattern)) {
        // Safe: groups 1-3 always exist when the pattern matches
        const jsdocBody = match[1]!;
        const name = match[2]!;
        const value = match[3]!;

        // Extract @type from first content line
        const typeMatch = jsdocBody.match(/@type\s+(.+)/);
        const rawType = typeMatch?.[1]?.trim() ?? "";

        // Categorize: known single types go to their category, everything else to "other"
        const type: OffsetType | "other" =
            (OFFSET_TYPES as readonly string[]).includes(rawType)
                ? (rawType as OffsetType)
                : "other";

        // Extract description: all JSDoc lines after @type, stripped of leading " * "
        const lines = jsdocBody.split("\n");
        const docLines: string[] = [];
        let pastType = typeMatch === null; // if no @type, all lines are description
        for (const line of lines) {
            const stripped = line.replace(/^\s*\*\s?/, "").trimEnd();
            if (!pastType) {
                if (stripped.startsWith("@type")) {
                    pastType = true;
                }
                continue;
            }
            docLines.push(stripped);
        }
        const doc = docLines.join("\n").trim();

        results.push({ name, value, type, doc });
    }

    return results;
}

/**
 * Parses opcode .tph files with JSDoc descriptions (no @type tag).
 * Returns completion items for opcodes.
 */
function opcodeDefinesFromFile(filePath: string): readonly CompletionItem[] {
    const content = fs.readFileSync(filePath, "utf8");
    const results: CompletionItem[] = [];

    const pattern = /\/\*\*([\s\S]*?)\*\/\s*\n\s*OUTER_SET\s+(\w+)\s*=\s*(\w+)/g;
    for (const match of content.matchAll(pattern)) {
        const jsdocBody = match[1]!;
        const name = match[2]!;
        const value = match[3]!;

        const lines = jsdocBody.split("\n");
        const docLines = lines
            .map((line) => line.replace(/^\s*\*\s?/, "").trimEnd())
            .filter((line) => line.length > 0);
        const doc = docLines.join("\n").trim();

        results.push({
            name,
            detail: `int ${name} = ${value}`,
            doc: doc || name,
        });
    }

    return results;
}

/**
 * Gets the display type for a parameter, formatted as a documentation link.
 */
function getPtype(tname: string, types: readonly TypeEntry[]): string {
    const found = types.find((x) => x.name === tname);
    if (found === undefined) {
        throw new Error(`Unknown parameter type: ${tname}`);
    }
    return `[${tname}](${TYPES_URL}/#${tname})`;
}

/**
 * Gets the default value for a function parameter.
 * Checks param-level default, then function-level type defaults.
 */
function getDefault(param: FuncParam, func: FuncData): string {
    if (param.default !== undefined) {
        return String(param.default);
    }
    if (func.defaults !== undefined && func.defaults[param.type] !== undefined) {
        // Safe: undefined check on the line above
        return func.defaults[param.type]!;
    }
    return "";
}

/**
 * Formats function parameters as a markdown table.
 */
function paramsToMd(
    func: FuncData,
    ptype: "int_params" | "string_params",
    types: readonly TypeEntry[]
): string {
    const typeMap: Readonly<Record<string, string>> = {
        string_params: "STR_VAR",
        int_params: "INT_VAR",
    };

    const params = func[ptype];
    if (params === undefined) {
        return "";
    }

    const sortedParams = [...params].sort((a, b) => cmpStr(a.name, b.name));
    const header = `| **${typeMap[ptype]}** | **Description** | **Type** | **Default** |\n|:-|:-|:-|:-|`;
    const rows = sortedParams.map((param) => {
        const defaultVal =
            param.required === 1 ? "_required_" : getDefault(param, func);
        const ptypeText = getPtype(param.type, types);
        return `| ${param.name} | ${param.desc} | ${ptypeText} | ${defaultVal} |`;
    });

    return `${header}\n${rows.join("\n")}\n`;
}

/**
 * Formats function return values as a markdown table.
 */
function retsToMd(func: FuncData, types: readonly TypeEntry[]): string {
    if (func.return === undefined) {
        return "";
    }

    const sortedRets = [...func.return].sort((a, b) => cmpStr(a.name, b.name));
    const header = "\n| RET vars | Description | Type |\n|:--------|:-----|:--------|";
    const rows = sortedRets.map((ret) => {
        const rtype = getPtype(ret.type, types);
        return `| ${ret.name} | ${ret.desc} | ${rtype} |`;
    });

    return `${header}\n${rows.join("\n")}\n`;
}

/**
 * Converts a function data entry to a completion item.
 */
function funcToItem(func: FuncData, types: readonly TypeEntry[]): CompletionItem {
    let text = `${func.desc}\n\n`;

    if (func.int_params !== undefined) {
        text += paramsToMd(func, "int_params", types);
    }
    if (func.string_params !== undefined) {
        text += paramsToMd(func, "string_params", types);
    }
    if (func.return !== undefined) {
        text += retsToMd(func, types);
    }

    return {
        name: func.name,
        detail: `${func.type} function ${func.name}`,
        doc: litscal(text),
        type: func.type,
    };
}

function main(): void {
    const { values } = parseArgs({
        options: {
            s: { type: "string" },
            "highlight-weidu": { type: "string" },
        },
    });

    const srcDir = values.s;
    const highlightWeidu = values["highlight-weidu"];

    if (!srcDir || !highlightWeidu) {
        console.error(
            "Usage: ielib-update -s <src_dir> --highlight-weidu <path>"
        );
        process.exit(1);
    }

    // CONSTANTS - extract plain defines from header files (no JSDoc)
    // Skip files parsed separately: iesdp.tph (typed offsets), opcode*.tph, spell_ids
    const defineFiles = findFiles(srcDir, "tph", ["functions"], [
        "iesdp.tph",
        "spell_ids_bgee.tph",
        "spell_ids_iwdee.tph",
        "opcode.tph",
        "opcode_ee.tph",
    ]);

    // First-writer-wins: existing entries take priority over new ones.
    // With alphabetical file order, base files (e.g. scrolls.tph) are processed
    // before override files (e.g. scrolls_iwdee.tph), so BG2 values are kept.
    // Accumulate via reduce to avoid let reassignment.
    const { intDefines, resrefDefines } = defineFiles.reduce(
        (acc, df) => {
            const newInt = definesFromFile(df, REGEX_NUMERIC);
            const newResref = definesFromFile(df, REGEX_TEXT);
            return {
                intDefines: new Map([...newInt, ...acc.intDefines]),
                resrefDefines: new Map([...newResref, ...acc.resrefDefines]),
            };
        },
        {
            intDefines: new Map<string, string>(),
            resrefDefines: new Map<string, string>(),
        },
    );

    const intItems: CompletionItem[] = [...intDefines.entries()].map(
        ([name, detail]) => ({
            name,
            detail: `int ${name} = ${detail}`,
            doc: "IElib define",
        })
    );

    const resrefItems: CompletionItem[] = [...resrefDefines.entries()].map(
        ([name, detail]) => ({
            name,
            detail: `resref ${name} = "${detail}"`,
            doc: "IElib define",
        })
    );

    // STRUCTURE OFFSETS - parse iesdp.tph files with JSDoc @type annotations
    const iesdpFiles = findFiles(path.join(srcDir, "structures"), "tph")
        .filter((f) => path.basename(f) === "iesdp.tph");
    const typedDefines = iesdpFiles.flatMap(typedDefinesFromFile);

    // Categorize by offset type
    const offsetsByType = new Map<OffsetType | "other", CompletionItem[]>();
    for (const t of [...OFFSET_TYPES, "other" as const]) {
        offsetsByType.set(t, []);
    }
    for (const def of typedDefines) {
        const items = offsetsByType.get(def.type)!; // Safe: all keys pre-initialized
        items.push({
            name: def.name,
            detail: `${def.type} offset ${def.name} = ${def.value}`,
            doc: def.doc || def.name,
        });
    }
    // Sort each category by name
    for (const items of offsetsByType.values()) {
        items.sort((a, b) => cmpStr(a.name, b.name));
    }

    // OPCODES - parse opcode.tph and opcode_ee.tph with JSDoc descriptions
    const opcodeFiles = [
        path.join(srcDir, "misc", "opcode.tph"),
        path.join(srcDir, "misc", "opcode_ee.tph"),
    ];
    const opcodeItems = opcodeFiles
        .filter((f) => fs.existsSync(f))
        .flatMap(opcodeDefinesFromFile)
        .sort((a, b) => cmpStr(a.name, b.name));

    // FUNCTIONS
    const dataDir = path.join(srcDir, "docs", "_data");
    const functionDir = path.join(dataDir, "functions");
    const functionFiles = findFiles(functionDir, "yml");
    const typesFile = path.join(dataDir, "types.yml");
    const types: readonly TypeEntry[] = validateArray(
        YAML.parse(fs.readFileSync(typesFile, "utf8")),
        validateTypeEntry,
        typesFile,
    );

    const actionFunctions: CompletionItem[] = [];
    const patchFunctions: CompletionItem[] = [];

    for (const f of functionFiles) {
        const data: readonly FuncData[] = validateArray(
            YAML.parse(fs.readFileSync(f, "utf8")),
            validateFuncData,
            f,
        );
        const sorted = [...data].sort((a, b) => cmpStr(a.name, b.name));
        for (const func of sorted) {
            const item = funcToItem(func, types);
            if (item.type === "action") {
                actionFunctions.push(item);
            }
            if (item.type === "patch") {
                patchFunctions.push(item);
            }
        }
    }

    // Build final data structure with all items populated
    const ielibData: IEData = {
        patch_functions: {
            stanza: "patch_functions",
            highlightStanza: "ielib-patch-functions",
            scope: "entity.name.function.weidu-tp2.patch-function-name",
            completion_type: COMPLETION_TYPE_FUNCTION,
            blockDoc: true,
            items: patchFunctions,
        },
        action_functions: {
            stanza: "action_functions",
            highlightStanza: "ielib-action-functions",
            scope: "support.function.weidu-tp2.action-function-name",
            completion_type: COMPLETION_TYPE_FUNCTION,
            blockDoc: true,
            items: actionFunctions,
        },
        resrefs: {
            stanza: "ielib_resref",
            highlightStanza: "ielib-resref",
            scope: "constant.language.ielib.resref",
            string: true,
            items: resrefItems,
        },
        ints: {
            stanza: "ielib_int",
            highlightStanza: "ielib-int",
            scope: "constant.language.ielib.int",
            items: intItems,
        },
        // Structure offsets from IElib iesdp.tph files (previously from IESDP YAML)
        iesdp_other: {
            stanza: "iesdp_other",
            highlightStanza: "iesdp-other",
            scope: "constant.language.iesdp.other",
            items: offsetsByType.get("other")!,
        },
        iesdp_strrefs: {
            stanza: "iesdp_strref",
            highlightStanza: "iesdp-strref",
            scope: "constant.language.iesdp.strref",
            items: offsetsByType.get("strref")!,
        },
        iesdp_resrefs: {
            stanza: "iesdp_resref",
            highlightStanza: "iesdp-resref",
            scope: "constant.language.iesdp.resref",
            items: offsetsByType.get("resref")!,
        },
        iesdp_dwords: {
            stanza: "iesdp_dword",
            highlightStanza: "iesdp-dword",
            scope: "constant.language.iesdp.dword",
            items: offsetsByType.get("dword")!,
        },
        iesdp_words: {
            stanza: "iesdp_word",
            highlightStanza: "iesdp-word",
            scope: "constant.language.iesdp.word",
            items: offsetsByType.get("word")!,
        },
        iesdp_bytes: {
            stanza: "iesdp_byte",
            highlightStanza: "iesdp-byte",
            scope: "constant.language.iesdp.byte",
            items: offsetsByType.get("byte")!,
        },
        iesdp_chars: {
            stanza: "iesdp_char",
            highlightStanza: "iesdp-char",
            scope: "constant.language.iesdp.char",
            items: offsetsByType.get("char")!,
        },
        // Opcodes from IElib opcode.tph / opcode_ee.tph
        opcodes: {
            stanza: "opcodes",
            highlightStanza: "ielib-opcodes",
            scope: "constant.language.ielib.opcode",
            items: opcodeItems,
        },
    };

    dumpHighlight(highlightWeidu, ielibData);
}

try {
    main();
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
}
