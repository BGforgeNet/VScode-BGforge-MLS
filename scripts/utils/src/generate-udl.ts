/**
 * Generates Notepad++ User Defined Language (UDL) XML files from YAML data.
 * Produces one UDL per language with keywords, comments, strings, and folding.
 *
 * Usage:
 *   pnpm exec tsx scripts/utils/src/generate-udl.ts --out-dir <dir>
 */

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { loadData } from "./generate-data";

// -- Types --

interface LanguageDef {
    readonly name: string;
    readonly ext: string;
    readonly yamlFiles: readonly string[];
    readonly caseIgnored: boolean;
    /** String delimiters: [open, close] pairs */
    readonly stringDelimiters: readonly (readonly [string, string])[];
    /** Code folding open/close pairs */
    readonly foldingPairs: readonly (readonly [string, string])[];
}

// -- Language definitions --

const DATA_DIR = "server/data";

const LANGUAGES: readonly LanguageDef[] = [
    {
        name: "fallout-ssl",
        ext: "ssl h",
        yamlFiles: [`${DATA_DIR}/fallout-ssl-base.yml`, `${DATA_DIR}/fallout-ssl-sfall.yml`],
        caseIgnored: false,
        stringDelimiters: [["\"", "\""]],
        foldingPairs: [["begin", "end"], ["{", "}"]],
    },
    {
        name: "weidu-baf",
        ext: "baf",
        yamlFiles: [`${DATA_DIR}/weidu-baf-base.yml`, `${DATA_DIR}/weidu-baf-iesdp.yml`, `${DATA_DIR}/weidu-baf-ids.yml`],
        caseIgnored: true,
        stringDelimiters: [["~", "~"], ["\"", "\""]],
        foldingPairs: [["IF", "END"]],
    },
    {
        name: "weidu-d",
        ext: "d",
        yamlFiles: [`${DATA_DIR}/weidu-d-base.yml`],
        caseIgnored: true,
        stringDelimiters: [["~", "~"], ["\"", "\""]],
        foldingPairs: [["BEGIN", "END"]],
    },
    {
        name: "weidu-tp2",
        ext: "tp2 tpa tph tpp",
        yamlFiles: [`${DATA_DIR}/weidu-tp2-base.yml`, `${DATA_DIR}/weidu-tp2-iesdp.yml`, `${DATA_DIR}/weidu-tp2-ielib.yml`],
        caseIgnored: true,
        stringDelimiters: [["~", "~"], ["\"", "\""], ["%", "%"]],
        foldingPairs: [["BEGIN", "END"]],
    },
];

// -- UDL type constants (from YAML data type field) --

const TYPE_FUNCTION = 3;
const TYPE_KEYWORD = 14;
const TYPE_CONSTANT = 21;

// -- XML generation --

/** Escape XML special characters in attribute values and text content. */
function escapeXml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * Build the Comments keyword line for UDL.
 * Format: "00// 01 02 03/\* 04\*\/"
 * All our languages use line comments and C-style block comments.
 */
function buildCommentsLine(): string {
    // UDL comment encoding: 00=line-open, 01=line-continue, 02=line-close,
    // 03=block-open, 04=block-close
    const lineOpen = "//";
    const blockOpen = "/*";
    const blockClose = "*/";
    return `00${lineOpen} 01 02 03${blockOpen} 04${blockClose}`;
}

/**
 * Build the Delimiters keyword line for UDL.
 * Each delimiter pair uses 3 slots: open, alt-open (empty), close.
 * Delimiter1 = slots 00-02, Delimiter2 = 03-05, ..., Delimiter8 = 21-23.
 */
function buildDelimitersLine(delimiters: readonly (readonly [string, string])[]): string {
    const parts: string[] = [];
    for (let i = 0; i < 8; i++) {
        const slotBase = i * 3;
        if (i < delimiters.length) {
            // Bounds-checked above: i < delimiters.length
            const [open, close] = delimiters[i]!;
            parts.push(`${String(slotBase).padStart(2, "0")}${escapeXml(open)}`);
            parts.push(`${String(slotBase + 1).padStart(2, "0")}`);
            parts.push(`${String(slotBase + 2).padStart(2, "0")}${escapeXml(close)}`);
        } else {
            parts.push(`${String(slotBase).padStart(2, "0")}`);
            parts.push(`${String(slotBase + 1).padStart(2, "0")}`);
            parts.push(`${String(slotBase + 2).padStart(2, "0")}`);
        }
    }
    return parts.join(" ");
}

/**
 * Collect unique keyword names from data stanzas, grouped by UDL keyword slot.
 * Mapping: type 14 (keyword) -> Keywords1, type 3 (function) -> Keywords2, type 21 (constant) -> Keywords3.
 */
function collectKeywords(yamlFiles: readonly string[]): {
    readonly keywords1: readonly string[];
    readonly keywords2: readonly string[];
    readonly keywords3: readonly string[];
} {
    const data = loadData(yamlFiles);

    const kw1 = new Set<string>();
    const kw2 = new Set<string>();
    const kw3 = new Set<string>();

    for (const stanza of Object.values(data)) {
        const target =
            stanza.type === TYPE_KEYWORD ? kw1 :
            stanza.type === TYPE_FUNCTION ? kw2 :
            stanza.type === TYPE_CONSTANT ? kw3 :
            null;
        if (target === null) continue;

        for (const item of stanza.items) {
            target.add(item.name);
        }
    }

    const sorted = (s: Set<string>) => [...s].sort();
    return {
        keywords1: sorted(kw1),
        keywords2: sorted(kw2),
        keywords3: sorted(kw3),
    };
}

/** Generate a complete UDL XML string for one language. */
export function generateUdlXml(lang: LanguageDef): string {
    const { keywords1, keywords2, keywords3 } = collectKeywords(lang.yamlFiles);
    const caseFlag = lang.caseIgnored ? "yes" : "no";

    const foldOpen = lang.foldingPairs.map(([o]) => escapeXml(o)).join(" ");
    const foldClose = lang.foldingPairs.map(([, c]) => escapeXml(c)).join(" ");

    return `<?xml version="1.0" encoding="UTF-8" ?>
<NotepadPlus>
    <UserLang name="${escapeXml(lang.name)}" ext="${escapeXml(lang.ext)}" udlVersion="2.1">
        <Settings>
            <Global caseIgnored="${caseFlag}" allowFoldOfComments="yes" foldCompact="no" forcePureLC="0" decimalSeparator="0" />
            <Prefix Keywords1="no" Keywords2="no" Keywords3="no" Keywords4="no" Keywords5="no" Keywords6="no" Keywords7="no" Keywords8="no" />
        </Settings>
        <KeywordLists>
            <Keywords name="Comments">${buildCommentsLine()}</Keywords>
            <Keywords name="Numbers, prefix1"></Keywords>
            <Keywords name="Numbers, prefix2">0x 0X</Keywords>
            <Keywords name="Numbers, extras1"></Keywords>
            <Keywords name="Numbers, extras2"></Keywords>
            <Keywords name="Numbers, suffix1"></Keywords>
            <Keywords name="Numbers, suffix2"></Keywords>
            <Keywords name="Numbers, range"></Keywords>
            <Keywords name="Operators1">- ! % &amp; ( ) * + , . / : ; &lt; = &gt; ? [ ] ^ | ~</Keywords>
            <Keywords name="Operators2"></Keywords>
            <Keywords name="Folders in code1, open">${foldOpen}</Keywords>
            <Keywords name="Folders in code1, middle"></Keywords>
            <Keywords name="Folders in code1, close">${foldClose}</Keywords>
            <Keywords name="Folders in code2, open"></Keywords>
            <Keywords name="Folders in code2, middle"></Keywords>
            <Keywords name="Folders in code2, close"></Keywords>
            <Keywords name="Folders in comment, open"></Keywords>
            <Keywords name="Folders in comment, middle"></Keywords>
            <Keywords name="Folders in comment, close"></Keywords>
            <Keywords name="Keywords1">${keywords1.join(" ")}</Keywords>
            <Keywords name="Keywords2">${keywords2.join(" ")}</Keywords>
            <Keywords name="Keywords3">${keywords3.join(" ")}</Keywords>
            <Keywords name="Keywords4"></Keywords>
            <Keywords name="Keywords5"></Keywords>
            <Keywords name="Keywords6"></Keywords>
            <Keywords name="Keywords7"></Keywords>
            <Keywords name="Keywords8"></Keywords>
            <Keywords name="Delimiters">${buildDelimitersLine(lang.stringDelimiters)}</Keywords>
        </KeywordLists>
        <Styles>
            <WordsStyle name="DEFAULT" fgColor="000000" bgColor="FFFFFF" fontStyle="0" nesting="0" />
            <WordsStyle name="COMMENTS" fgColor="008000" bgColor="FFFFFF" fontStyle="0" nesting="0" />
            <WordsStyle name="LINE COMMENTS" fgColor="008000" bgColor="FFFFFF" fontStyle="0" nesting="0" />
            <WordsStyle name="NUMBERS" fgColor="FF8000" bgColor="FFFFFF" fontStyle="0" nesting="0" />
            <WordsStyle name="KEYWORDS1" fgColor="0000FF" bgColor="FFFFFF" fontStyle="1" nesting="0" />
            <WordsStyle name="KEYWORDS2" fgColor="800080" bgColor="FFFFFF" fontStyle="0" nesting="0" />
            <WordsStyle name="KEYWORDS3" fgColor="FF8000" bgColor="FFFFFF" fontStyle="0" nesting="0" />
            <WordsStyle name="KEYWORDS4" fgColor="000000" bgColor="FFFFFF" fontStyle="0" nesting="0" />
            <WordsStyle name="KEYWORDS5" fgColor="000000" bgColor="FFFFFF" fontStyle="0" nesting="0" />
            <WordsStyle name="KEYWORDS6" fgColor="000000" bgColor="FFFFFF" fontStyle="0" nesting="0" />
            <WordsStyle name="KEYWORDS7" fgColor="000000" bgColor="FFFFFF" fontStyle="0" nesting="0" />
            <WordsStyle name="KEYWORDS8" fgColor="000000" bgColor="FFFFFF" fontStyle="0" nesting="0" />
            <WordsStyle name="OPERATORS" fgColor="000080" bgColor="FFFFFF" fontStyle="1" nesting="0" />
            <WordsStyle name="FOLDER IN CODE1" fgColor="000000" bgColor="FFFFFF" fontStyle="0" nesting="0" />
            <WordsStyle name="FOLDER IN CODE2" fgColor="000000" bgColor="FFFFFF" fontStyle="0" nesting="0" />
            <WordsStyle name="FOLDER IN COMMENT" fgColor="000000" bgColor="FFFFFF" fontStyle="0" nesting="0" />
            <WordsStyle name="DELIMITERS1" fgColor="808080" bgColor="FFFFFF" fontStyle="0" nesting="0" />
            <WordsStyle name="DELIMITERS2" fgColor="808080" bgColor="FFFFFF" fontStyle="0" nesting="0" />
            <WordsStyle name="DELIMITERS3" fgColor="808080" bgColor="FFFFFF" fontStyle="0" nesting="0" />
            <WordsStyle name="DELIMITERS4" fgColor="000000" bgColor="FFFFFF" fontStyle="0" nesting="0" />
            <WordsStyle name="DELIMITERS5" fgColor="000000" bgColor="FFFFFF" fontStyle="0" nesting="0" />
            <WordsStyle name="DELIMITERS6" fgColor="000000" bgColor="FFFFFF" fontStyle="0" nesting="0" />
            <WordsStyle name="DELIMITERS7" fgColor="000000" bgColor="FFFFFF" fontStyle="0" nesting="0" />
            <WordsStyle name="DELIMITERS8" fgColor="000000" bgColor="FFFFFF" fontStyle="0" nesting="0" />
        </Styles>
    </UserLang>
</NotepadPlus>
`;
}

// -- CLI entry point --

/* v8 ignore start -- CLI wrapper */
function main(): void {
    const { values } = parseArgs({
        options: {
            "out-dir": { type: "string" },
        },
        strict: true,
    });

    const outDir = values["out-dir"];
    if (outDir === undefined) {
        console.error("Usage: generate-udl --out-dir <dir>");
        process.exit(1);
    }

    fs.mkdirSync(outDir, { recursive: true });

    for (const lang of LANGUAGES) {
        const xml = generateUdlXml(lang);
        const outPath = path.join(outDir, `${lang.name}.udl.xml`);
        fs.writeFileSync(outPath, xml, "utf8");
        console.log(`Created ${outPath}`);
    }
}

const isDirectRun = process.argv[1]?.endsWith("generate-udl.ts");
if (isDirectRun) {
    main();
}
/* v8 ignore stop */
