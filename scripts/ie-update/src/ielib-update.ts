/**
 * IElib structure offset update script.
 * Extracts IESDP structure offsets from IElib iesdp.tph header files
 * and generates TextMate highlight patterns in the TP2 grammar.
 *
 * IElib constants (resref, int, opcodes) and functions are no longer
 * hardcoded — they come from user headers via @type annotations and
 * the symbol index at runtime.
 */

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import {
    cmpStr,
    dumpHighlight,
    findFiles,
} from "./ie/index.ts";
import type {
    CompletionItem,
    IEData,
} from "./ie/index.ts";
import { IESDP_STANZAS } from "./stanza-names.ts";

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

    const iesdpData: IEData = {
        iesdp_other: {
            stanza: IESDP_STANZAS.iesdp_other,
            highlightStanza: "iesdp-other",
            scope: "constant.language.iesdp.other",
            items: offsetsByType.get("other")!,
        },
        iesdp_strrefs: {
            stanza: IESDP_STANZAS.iesdp_strref,
            highlightStanza: "iesdp-strref",
            scope: "constant.language.iesdp.strref",
            items: offsetsByType.get("strref")!,
        },
        iesdp_resrefs: {
            stanza: IESDP_STANZAS.iesdp_resref,
            highlightStanza: "iesdp-resref",
            scope: "constant.language.iesdp.resref",
            items: offsetsByType.get("resref")!,
        },
        iesdp_dwords: {
            stanza: IESDP_STANZAS.iesdp_dword,
            highlightStanza: "iesdp-dword",
            scope: "constant.language.iesdp.dword",
            items: offsetsByType.get("dword")!,
        },
        iesdp_words: {
            stanza: IESDP_STANZAS.iesdp_word,
            highlightStanza: "iesdp-word",
            scope: "constant.language.iesdp.word",
            items: offsetsByType.get("word")!,
        },
        iesdp_bytes: {
            stanza: IESDP_STANZAS.iesdp_byte,
            highlightStanza: "iesdp-byte",
            scope: "constant.language.iesdp.byte",
            items: offsetsByType.get("byte")!,
        },
        iesdp_chars: {
            stanza: IESDP_STANZAS.iesdp_char,
            highlightStanza: "iesdp-char",
            scope: "constant.language.iesdp.char",
            items: offsetsByType.get("char")!,
        },
    };

    dumpHighlight(highlightWeidu, iesdpData);
}

try {
    main();
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
}
