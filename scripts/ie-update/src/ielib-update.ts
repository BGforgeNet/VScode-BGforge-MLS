/**
 * IElib data update script.
 * Extracts constants and function definitions from IElib header files
 * and generates IDE completion/highlight YAML files for the VSCode extension.
 *
 * Replaces the Python ielib_update.py script.
 */

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import YAML from "yaml";
import {
    cmpStr,
    COMPLETION_TYPE_FUNCTION,
    dumpCompletion,
    dumpHighlight,
    findFiles,
    litscal,
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
 * Extracts defines from a file matching a given regex pattern.
 * Returns a map of name -> value for all matching lines.
 */
function definesFromFile(filePath: string, regex: RegExp): ReadonlyMap<string, string> {
    const content = fs.readFileSync(filePath, "utf8");
    const defines = new Map<string, string>();
    for (const line of content.split("\n")) {
        const match = line.match(regex);
        if (match !== null) {
            defines.set(match[1]!, match[2]!);
        }
    }
    return defines;
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
        return param.default;
    }
    if (func.defaults !== undefined && func.defaults[param.type] !== undefined) {
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
            "data-file": { type: "string" },
            "highlight-weidu": { type: "string" },
        },
    });

    const srcDir = values.s;
    const dataFile = values["data-file"];
    const highlightWeidu = values["highlight-weidu"];

    if (!srcDir || !dataFile || !highlightWeidu) {
        console.error(
            "Usage: ielib-update -s <src_dir> --data-file <path> --highlight-weidu <path>"
        );
        process.exit(1);
    }

    // CONSTANTS - extract defines from header files
    const defineFiles = findFiles(srcDir, "tph", ["functions"], [
        "iesdp.tph",
        "spell_ids_bgee.tph",
        "spell_ids_iwdee.tph",
        "item_types.tph",
    ]);

    let intDefines = new Map<string, string>();
    let resrefDefines = new Map<string, string>();

    for (const df of defineFiles) {
        const newIntDefines = definesFromFile(df, REGEX_NUMERIC);
        // First-writer-wins: existing entries take priority over new ones.
        // With alphabetical file order, base files (e.g. scrolls.tph) are processed
        // before override files (e.g. scrolls_iwdee.tph), so BG2 values are kept.
        intDefines = new Map([...newIntDefines, ...intDefines]);
        const newResrefDefines = definesFromFile(df, REGEX_TEXT);
        resrefDefines = new Map([...newResrefDefines, ...resrefDefines]);
    }

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

    // FUNCTIONS
    const dataDir = path.join(srcDir, "docs", "_data");
    const functionDir = path.join(dataDir, "functions");
    const functionFiles = findFiles(functionDir, "yml");
    const typesFile = path.join(dataDir, "types.yml");
    const types: readonly TypeEntry[] = YAML.parse(fs.readFileSync(typesFile, "utf8"));

    const actionFunctions: CompletionItem[] = [];
    const patchFunctions: CompletionItem[] = [];

    for (const f of functionFiles) {
        const data: FuncData[] = YAML.parse(fs.readFileSync(f, "utf8"));
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
    // Order matches Python ielib_update.py for minimal diff
    const ielibData: IEData = {
        patch_functions: {
            stanza: "patchFunctions",
            highlightStanza: "ielib-patch-functions",
            scope: "entity.name.function.weidu-tp2.patch-function-name",
            completion_type: COMPLETION_TYPE_FUNCTION,
            blockDoc: true,
            items: patchFunctions,
        },
        action_functions: {
            stanza: "actionFunctions",
            highlightStanza: "ielib-action-functions",
            scope: "support.function.weidu-tp2.action-function-name",
            completion_type: COMPLETION_TYPE_FUNCTION,
            blockDoc: true,
            items: actionFunctions,
        },
        resrefs: {
            stanza: "ielibResref",
            highlightStanza: "ielib-resref",
            scope: "constant.language.ielib.resref",
            string: true,
            items: resrefItems,
        },
        ints: {
            stanza: "ielibInt",
            highlightStanza: "ielib-int",
            scope: "constant.language.ielib.int",
            items: intItems,
        },
    };

    dumpCompletion(dataFile, ielibData);
    dumpHighlight(highlightWeidu, ielibData);
}

try {
    main();
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
}
