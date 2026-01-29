/**
 * IESDP data update script.
 * Processes IESDP opcode, action, and file format data into IElib TPP definitions
 * and IDE completion/highlight YAML files for the VSCode extension.
 *
 * Replaces the Python iesdp_update.py script.
 */

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import YAML, { isMap } from "yaml";
import {
    actionDesc,
    actionDetail,
    appendUnique,
    cmpStr,
    createItemsSeq,
    dumpCompletion,
    dumpDefinition,
    dumpHighlight,
    findFiles,
    getFormatVersion,
    getItemTypes,
    getItemTypesIsense,
    getOffsetId,
    getOffsetPrefix,
    getOffsetSize,
    litscal,
    offsetIsUnused,
    offsetsToDefinition,
    opcodeNameToId,
    saveItemTypesIelib,
    stripLiquid,
    validateActionItem,
    validateArray,
    validateIESDPGame,
    validateOffset,
    validateOffsetItem,
} from "./ie/index.js";
import type {
    ActionItem,
    CompletionItem,
    IEData,
    IESDPGame,
    OpcodeEntry,
    OffsetItem,
    ProcessedIESDPData,
} from "./ie/index.js";

/** Opcode names to skip during processing */
const SKIP_OPCODE_NAMES = ["empty", "crash", "unknown"];
/** IESDP base URL for documentation links */
const IESDP_BASE_URL = "https://gibberlings3.github.io/iesdp/";
/** Actions stanza key in YAML data */
const ACTIONS_STANZA = "actions";

/**
 * Parses YAML frontmatter from an HTML file and validates opcode fields.
 * Expects files starting with '---' delimiter.
 */
function parseOpcodeFrontmatter(filePath: string): OpcodeEntry {
    const content = fs.readFileSync(filePath, "utf8");
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (fmMatch === null) {
        throw new Error(`No frontmatter found in ${filePath}`);
    }
    // Safe: regex group 1 always exists when the match succeeds
    const data: unknown = YAML.parse(fmMatch[1]!);
    if (typeof data !== "object" || data === null) {
        throw new Error(`Expected object in frontmatter of ${filePath}`);
    }
    const record = data as Record<string, unknown>;
    if (typeof record["n"] !== "number") {
        throw new Error(`Missing or invalid 'n' in ${filePath}`);
    }
    if (typeof record["opname"] !== "string") {
        throw new Error(`Missing or invalid 'opname' in ${filePath}`);
    }
    return {
        n: record["n"],
        bg2: typeof record["bg2"] === "number" ? record["bg2"] : 0,
        opname: record["opname"],
    };
}

/**
 * Appends offset items to the appropriate category in ProcessedIESDPData.
 * Copies input arrays once, then uses push for efficiency. Returns a new object.
 */
function appendOffsets(
    pod: ProcessedIESDPData,
    offsetData: readonly OffsetItem[],
    offsetPrefix: string
): ProcessedIESDPData {
    const firstItem = offsetData[0];
    if (firstItem === undefined) {
        return pod;
    }

    const chars = [...pod.chars];
    const lbytes = [...pod.lbytes];
    const words = [...pod.words];
    const dwords = [...pod.dwords];
    const resrefs = [...pod.resrefs];
    const strrefs = [...pod.strrefs];
    const other = [...pod.other];

    let curOff = firstItem.offset ?? 0;

    for (const item of offsetData) {
        validateOffset(curOff, item);
        const size = getOffsetSize(item);

        if (offsetIsUnused(item)) {
            curOff += size;
            continue;
        }

        const iid = getOffsetId(item, offsetPrefix);
        const itemOff = `0x${curOff.toString(16)}`;
        const hasMult = item.mult !== undefined;
        const detail = hasMult
            ? `multi ${item.type} offset ${iid} = ${itemOff}`
            : `${item.type} offset ${iid} = ${itemOff}`;

        const completionItem: CompletionItem = {
            name: iid,
            detail,
            doc: stripLiquid(item.desc),
        };

        if (hasMult) {
            other.push(completionItem);
        } else if (item.type === "char") {
            chars.push(completionItem);
        } else if (item.type === "byte") {
            lbytes.push(completionItem);
        } else if (item.type === "word") {
            words.push(completionItem);
        } else if (item.type === "dword") {
            dwords.push(completionItem);
        } else if (item.type === "resref") {
            resrefs.push(completionItem);
        } else if (item.type === "strref") {
            strrefs.push(completionItem);
        } else {
            other.push(completionItem);
        }
        curOff += size;
    }

    return { chars, lbytes, words, dwords, resrefs, strrefs, other };
}

/**
 * Validates that no duplicate names exist within a list of completion items.
 * Throws with diagnostic info if duplicates are found.
 */
function sanitiseList(items: readonly CompletionItem[]): void {
    const counts = new Map<string, number>();
    for (const item of items) {
        counts.set(item.name, (counts.get(item.name) ?? 0) + 1);
    }
    const nonUnique = [...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name);
    if (nonUnique.length > 0) {
        throw new Error(`Duplicate keys found: ${JSON.stringify(nonUnique)}`);
    }
}

/**
 * Validates all categories of processed data for duplicate names.
 */
function sanitise(pod: ProcessedIESDPData): void {
    sanitiseList(pod.chars);
    sanitiseList(pod.lbytes);
    sanitiseList(pod.words);
    sanitiseList(pod.dwords);
    sanitiseList(pod.resrefs);
    sanitiseList(pod.strrefs);
    sanitiseList(pod.other);
}

/**
 * Processes IESDP opcode HTML files into a TPP definition file.
 * Extracts BG2 opcodes, deduplicates names, and writes OPCODE_* constants.
 */
function processOpcodes(iesdpDir: string, ielibDir: string): void {
    const opcodeFile = path.join(ielibDir, "misc", "opcode.tpp");
    const opcodeDir = path.join(iesdpDir, "_opcodes");
    const opcodeFiles = findFiles(opcodeDir, "html");

    const rawOpcodes = opcodeFiles
        .map(parseOpcodeFrontmatter)
        .filter((o) => o.bg2 === 1)
        .sort((a, b) => a.n - b.n);

    const opcodesUnique = new Map<string, number>();
    for (const o of rawOpcodes) {
        let name = opcodeNameToId(o.opname);
        if (SKIP_OPCODE_NAMES.includes(name)) {
            continue;
        }
        if (opcodesUnique.has(name)) {
            // Append suffix for duplicate opcode names (e.g. "cure_disease_2")
            let counter = 2;
            while (opcodesUnique.has(`${name}_${counter}`)) {
                counter++;
            }
            name = `${name}_${counter}`;
        }
        opcodesUnique.set(name, o.n);
    }

    let tppText = "";
    for (const [name, value] of opcodesUnique) {
        tppText += `OPCODE_${name} = ${value}\n`;
    }
    fs.writeFileSync(opcodeFile, tppText + "\n", "utf8");
}

/**
 * Loads and filters IESDP action YAML files.
 * Returns actions sorted by number (param count descending as tiebreaker).
 */
function loadActions(iesdpDir: string): readonly ActionItem[] {
    const actionsDir = path.join(iesdpDir, "_data", "actions");
    const actionFiles = findFiles(actionsDir, "yml");

    const actions: ActionItem[] = [];
    for (const f of actionFiles) {
        const action: ActionItem = validateActionItem(YAML.parse(fs.readFileSync(f, "utf8")), f);
        if (
            (action.bg2 !== undefined && action.bg2 === 1) ||
            (action.bgee !== undefined && action.bgee === 1)
        ) {
            actions.push(action);
        }
    }
    // Sort by action number; break ties by param count descending so the most
    // complete signature wins in appendUnique (which keeps the first occurrence).
    return [...actions].sort((a, b) => {
        if (a.n !== b.n) return a.n - b.n;
        return (b.params?.length ?? 0) - (a.params?.length ?? 0);
    });
}

/**
 * Writes BAF highlight patterns from sorted action names.
 */
function writeActionsHighlight(
    actions: readonly ActionItem[],
    highlightBaf: string,
): void {
    const actionsHighlight = [...new Set(actions.map((x) => x.name))];
    const actionsHighlightPatterns = actionsHighlight
        .map((x) => ({ match: `\\b(${x})\\b` }))
        .sort((a, b) => cmpStr(a.match, b.match));

    const bafHighlightDoc = YAML.parseDocument(fs.readFileSync(highlightBaf, "utf8"));
    const actionsStanzaNode = bafHighlightDoc.getIn(["repository", ACTIONS_STANZA], true);
    if (!isMap(actionsStanzaNode)) {
        throw new Error(`Expected 'repository.actions' map in ${highlightBaf}`);
    }
    actionsStanzaNode.set(
        "patterns",
        bafHighlightDoc.createNode(actionsHighlightPatterns)
    );
    fs.writeFileSync(
        highlightBaf,
        bafHighlightDoc.toString({ lineWidth: 4096, indent: 2, indentSeq: true }),
        "utf8"
    );
}

/**
 * Deduplicates actions and builds BAF completion items.
 */
function buildActionsCompletion(
    actions: readonly ActionItem[],
    iesdpGames: readonly IESDPGame[],
): readonly CompletionItem[] {
    const parentsBg2 = actions.filter((x) => x.bg2 !== undefined && x.alias === undefined);
    const aliasesBg2 = actions.filter((x) => x.bg2 !== undefined && x.alias !== undefined);
    const parentsBgee = actions.filter(
        (x) => x.bgee !== undefined && x.bg2 === undefined && x.alias === undefined
    );
    const aliasesBgee = actions.filter(
        (x) => x.bgee !== undefined && x.bg2 === undefined && x.alias !== undefined
    );

    // Priority: classic actions > classic aliases > EE in the same order
    let actionsUnique = appendUnique([], parentsBg2);
    actionsUnique = appendUnique(actionsUnique, aliasesBg2);
    actionsUnique = appendUnique(actionsUnique, parentsBgee);
    actionsUnique = appendUnique(actionsUnique, aliasesBgee);

    const items: CompletionItem[] = [];
    for (const a of actionsUnique) {
        if (a.no_result || a.unknown || a.name.includes("Dialogue")) {
            continue;
        }
        let desc = actionDesc(actionsUnique, a, iesdpGames, IESDP_BASE_URL);
        if (desc === false) {
            continue;
        }
        desc = litscal(desc);
        desc = stripLiquid(desc);
        items.push({
            name: a.name,
            detail: actionDetail(a),
            doc: desc,
        });
    }

    return [...items].sort((a, b) => cmpStr(a.name, b.name));
}

/**
 * Writes BAF completion data to YAML file.
 */
function writeActionsCompletion(
    dataBaf: string,
    items: readonly CompletionItem[],
): void {
    const bafDataDoc = YAML.parseDocument(fs.readFileSync(dataBaf, "utf8"));
    const actionsNode = bafDataDoc.get(ACTIONS_STANZA, true);
    if (!isMap(actionsNode)) {
        throw new Error(`Expected '${ACTIONS_STANZA}' map in ${dataBaf}`);
    }
    const itemsSeq = createItemsSeq(bafDataDoc, items, true);
    actionsNode.set("items", itemsSeq);
    fs.writeFileSync(
        dataBaf,
        bafDataDoc.toString({ lineWidth: 4096, indent: 2, indentSeq: true }),
        "utf8"
    );
}

/**
 * Loads action YAML files, deduplicates, and writes BAF completion/highlight data.
 */
function processActions(
    iesdpDir: string,
    dataBaf: string,
    highlightBaf: string,
): void {
    const actions = loadActions(iesdpDir);

    const iesdpGamesFile = path.join(iesdpDir, "_data", "games.yml");
    const iesdpGames: readonly IESDPGame[] = validateArray(
        YAML.parse(fs.readFileSync(iesdpGamesFile, "utf8")),
        validateIESDPGame,
        iesdpGamesFile,
    );

    writeActionsHighlight(actions, highlightBaf);

    const completionItems = buildActionsCompletion(actions, iesdpGames);
    writeActionsCompletion(dataBaf, completionItems);
}

/**
 * Processes file format offset YAML files into completion data and IElib TPP definitions.
 * Returns the accumulated ProcessedIESDPData with all offset categories populated.
 */
function processOffsets(
    iesdpFileFormatsDir: string,
    ielibStructuresDir: string,
): ProcessedIESDPData {
    let pod: ProcessedIESDPData = {
        chars: [],
        lbytes: [],
        words: [],
        dwords: [],
        resrefs: [],
        strrefs: [],
        other: [],
    };

    const formats = fs
        .readdirSync(iesdpFileFormatsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);

    for (const ff of formats) {
        const ffDir = path.join(iesdpFileFormatsDir, ff);
        let definitionItems = new Map<string, string>();

        const files = fs.readdirSync(ffDir).filter((f) => f !== "feature_block.yml");
        for (const f of files) {
            const prefix = getOffsetPrefix(ff, f);
            const fpath = path.join(ffDir, f);
            const offsets: readonly OffsetItem[] = validateArray(
                YAML.parse(fs.readFileSync(fpath, "utf8")),
                validateOffsetItem,
                fpath,
            );

            const newDefinitionItems = offsetsToDefinition(offsets, prefix);
            definitionItems = new Map([...definitionItems, ...newDefinitionItems]);

            pod = appendOffsets(pod, offsets, prefix);
        }

        const prefixDir = getFormatVersion(ff);
        dumpDefinition(prefixDir, definitionItems, ielibStructuresDir);
    }

    // Feature block (handled separately from format-specific files)
    const featureBlockPath = path.join(iesdpFileFormatsDir, "itm_v1", "feature_block.yml");
    const featureBlockOffsets: readonly OffsetItem[] = validateArray(
        YAML.parse(fs.readFileSync(featureBlockPath, "utf8")),
        validateOffsetItem,
        featureBlockPath,
    );
    const PREFIX_FX = "FX_";
    pod = appendOffsets(pod, featureBlockOffsets, PREFIX_FX);

    const fxDefinitionItems = offsetsToDefinition(featureBlockOffsets, PREFIX_FX);
    dumpDefinition(PREFIX_FX, fxDefinitionItems, ielibStructuresDir);

    return pod;
}

/**
 * Builds the final IESDP data structure from processed offset categories.
 */
function buildIesdpData(pod: ProcessedIESDPData): IEData {
    return {
        other: {
            stanza: "iesdpOther",
            highlightStanza: "iesdp-other",
            items: [...pod.other],
            scope: "constant.language.iesdp.other",
        },
        strrefs: {
            stanza: "iesdpStrref",
            highlightStanza: "iesdp-strref",
            items: [...pod.strrefs],
            scope: "constant.language.iesdp.strref",
        },
        resrefs: {
            stanza: "iesdpResref",
            highlightStanza: "iesdp-resref",
            items: [...pod.resrefs],
            scope: "constant.language.iesdp.resref",
        },
        dwords: {
            stanza: "iesdpDword",
            highlightStanza: "iesdp-dword",
            items: [...pod.dwords],
            scope: "constant.language.iesdp.dword",
        },
        words: {
            stanza: "iesdpWord",
            highlightStanza: "iesdp-word",
            items: [...pod.words],
            scope: "constant.language.iesdp.word",
        },
        bytes: {
            stanza: "iesdpByte",
            highlightStanza: "iesdp-byte",
            items: [...pod.lbytes],
            scope: "constant.language.iesdp.byte",
        },
        chars: {
            stanza: "iesdpChar",
            highlightStanza: "iesdp-char",
            items: [...pod.chars],
            scope: "constant.language.iesdp.char",
        },
    };
}

function main(): void {
    const { values } = parseArgs({
        options: {
            s: { type: "string" },
            "data-baf": { type: "string" },
            "highlight-baf": { type: "string" },
            "iesdp-file": { type: "string" },
            "highlight-weidu": { type: "string" },
            "ielib-dir": { type: "string" },
        },
    });

    const iesdpDir = values.s;
    const dataBaf = values["data-baf"];
    const highlightBaf = values["highlight-baf"];
    const iesdpFile = values["iesdp-file"];
    const highlightWeidu = values["highlight-weidu"];
    const ielibDir = values["ielib-dir"];

    if (!iesdpDir || !dataBaf || !highlightBaf || !iesdpFile || !highlightWeidu || !ielibDir) {
        console.error(
            "Usage: iesdp-update -s <iesdp_dir> --data-baf <path> --highlight-baf <path> --iesdp-file <path> --highlight-weidu <path> --ielib-dir <path>"
        );
        process.exit(1);
    }

    const iesdpFileFormatsDir = path.join(iesdpDir, "_data", "file_formats");
    const ielibStructuresDir = path.join(ielibDir, "structures");

    processOpcodes(iesdpDir, ielibDir);

    const itemTypes = getItemTypes(iesdpFileFormatsDir);
    saveItemTypesIelib(ielibStructuresDir, itemTypes);

    processActions(iesdpDir, dataBaf, highlightBaf);

    const pod = processOffsets(iesdpFileFormatsDir, ielibStructuresDir);

    // Add item types to offset data
    const itemTypesIsense = getItemTypesIsense(itemTypes);
    const podWithItemTypes: ProcessedIESDPData = {
        ...pod,
        other: [...pod.other, ...itemTypesIsense],
    };

    sanitise(podWithItemTypes);

    const iesdpData = buildIesdpData(podWithItemTypes);
    dumpCompletion(iesdpFile, iesdpData);
    dumpHighlight(highlightWeidu, iesdpData);
}

try {
    main();
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
}
