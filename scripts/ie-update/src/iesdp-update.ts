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
import YAML from "yaml";
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
    validateOffset,
} from "./ie/index.js";
import type {
    ActionItem,
    CompletionItem,
    IEData,
    IESDPGame,
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
 * Parses YAML frontmatter from an HTML file (similar to Python's frontmatter.load).
 * Expects files starting with '---' delimiter.
 */
function parseFrontmatter(filePath: string): Record<string, unknown> {
    const content = fs.readFileSync(filePath, "utf8");
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (fmMatch === null) {
        throw new Error(`No frontmatter found in ${filePath}`);
    }
    return YAML.parse(fmMatch[1]!) as Record<string, unknown>;
}

/**
 * Appends offset items to the appropriate category in ProcessedIESDPData.
 * Returns a new ProcessedIESDPData (immutable).
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

    let curOff = firstItem.offset ?? 0;
    let chars = [...pod.chars];
    let lbytes = [...pod.lbytes];
    let words = [...pod.words];
    let dwords = [...pod.dwords];
    let resrefs = [...pod.resrefs];
    let strrefs = [...pod.strrefs];
    let other = [...pod.other];

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
            other = [...other, completionItem];
        } else if (item.type === "char") {
            chars = [...chars, completionItem];
        } else if (item.type === "byte") {
            lbytes = [...lbytes, completionItem];
        } else if (item.type === "word") {
            words = [...words, completionItem];
        } else if (item.type === "dword") {
            dwords = [...dwords, completionItem];
        } else if (item.type === "resref") {
            resrefs = [...resrefs, completionItem];
        } else if (item.type === "strref") {
            strrefs = [...strrefs, completionItem];
        } else {
            other = [...other, completionItem];
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
    const sorted = [...items].sort((a, b) => cmpStr(a.name, b.name));
    const names = sorted.map((x) => x.name);
    const counts = new Map<string, number>();
    for (const name of names) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
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

    // OPCODES
    const opcodeFile = path.join(ielibDir, "misc", "opcode.tpp");
    const opcodeDir = path.join(iesdpDir, "_opcodes");
    const opcodeFiles = findFiles(opcodeDir, "html");

    const rawOpcodes = opcodeFiles
        .map(parseFrontmatter)
        .filter((o) => o["bg2"] === 1)
        .sort((a, b) => (a["n"] as number) - (b["n"] as number));

    const opcodesUnique = new Map<string, number>();
    for (const o of rawOpcodes) {
        let name = opcodeNameToId(o["opname"] as string);
        if (SKIP_OPCODE_NAMES.includes(name)) {
            continue;
        }
        const existingCount = [...opcodesUnique.keys()].filter((k) => k === name).length;
        if (existingCount > 0) {
            name = `${name}_${existingCount + 1}`;
        }
        opcodesUnique.set(name, o["n"] as number);
    }

    let tppText = "";
    for (const [name, value] of opcodesUnique) {
        tppText += `OPCODE_${name} = ${value}\n`;
    }
    fs.writeFileSync(opcodeFile, tppText + "\n", "utf8");
    // END OPCODES

    // ITEM TYPES
    const itemTypes = getItemTypes(iesdpFileFormatsDir);
    saveItemTypesIelib(ielibStructuresDir, itemTypes);

    // ACTIONS
    const actionsDir = path.join(iesdpDir, "_data", "actions");
    const actionFiles = findFiles(actionsDir, "yml");

    const iesdpGamesFile = path.join(iesdpDir, "_data", "games.yml");
    const iesdpGames: readonly IESDPGame[] = YAML.parse(
        fs.readFileSync(iesdpGamesFile, "utf8")
    );

    let actions: ActionItem[] = [];
    for (const f of actionFiles) {
        const action: ActionItem = YAML.parse(fs.readFileSync(f, "utf8"));
        if (
            (action.bg2 !== undefined && action.bg2 === 1) ||
            (action.bgee !== undefined && action.bgee === 1)
        ) {
            actions.push(action);
        }
    }
    // Sort by action number; break ties by param count descending so the most
    // complete signature wins in appendUnique (which keeps the first occurrence).
    actions = actions.sort((a, b) => {
        if (a.n !== b.n) return a.n - b.n;
        return (b.params?.length ?? 0) - (a.params?.length ?? 0);
    });

    // Highlight
    const actionsHighlight = [...new Set(actions.map((x) => x.name))];
    const actionsHighlightPatterns = actionsHighlight
        .map((x) => ({ match: `\\b(${x})\\b` }))
        .sort((a, b) => cmpStr(a.match, b.match));

    // Dump highlight for BAF
    const bafHighlightContent = fs.readFileSync(highlightBaf, "utf8");
    const bafHighlightDoc = YAML.parseDocument(bafHighlightContent);
    // Update only the patterns key, preserving existing keys like 'name'
    const actionsStanzaNode = bafHighlightDoc.getIn(["repository", ACTIONS_STANZA], true);
    if (actionsStanzaNode && typeof actionsStanzaNode === "object" && "set" in actionsStanzaNode) {
        (actionsStanzaNode as { set: (key: string, value: unknown) => void }).set(
            "patterns",
            bafHighlightDoc.createNode(actionsHighlightPatterns)
        );
    }
    fs.writeFileSync(
        highlightBaf,
        bafHighlightDoc.toString({ lineWidth: 4096, indent: 2, indentSeq: true }),
        "utf8"
    );

    // Deduplicate actions
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

    const actionsCompletion: CompletionItem[] = [];
    for (const a of actionsUnique) {
        if (a.no_result) {
            continue;
        }
        if (a.unknown) {
            continue;
        }
        if (a.name.includes("Dialogue")) {
            continue; // dupes of Dialog
        }
        let desc = actionDesc(actionsUnique, a, iesdpGames, IESDP_BASE_URL);
        if (desc === false) {
            continue;
        }
        desc = litscal(desc);
        desc = stripLiquid(desc);
        actionsCompletion.push({
            name: a.name,
            detail: actionDetail(a),
            doc: desc,
        });
    }

    const sortedActionsCompletion = actionsCompletion.sort((a, b) =>
        cmpStr(a.name, b.name)
    );

    // Dump BAF completion data using createItemsSeq for consistent |- block scalar style
    const bafDataContent = fs.readFileSync(dataBaf, "utf8");
    const bafDataDoc = YAML.parseDocument(bafDataContent);
    const actionsNode = bafDataDoc.get(ACTIONS_STANZA, true);
    if (actionsNode && typeof actionsNode === "object" && "set" in actionsNode) {
        const itemsSeq = createItemsSeq(bafDataDoc, sortedActionsCompletion, true);
        (actionsNode as { set: (key: string, value: unknown) => void }).set(
            "items",
            itemsSeq
        );
    }
    fs.writeFileSync(
        dataBaf,
        bafDataDoc.toString({ lineWidth: 4096, indent: 2, indentSeq: true }),
        "utf8"
    );
    // END ACTIONS

    // DATA - file format offsets
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
        console.log(ff);
        const ffDir = path.join(iesdpFileFormatsDir, ff);
        let definitionItems = new Map<string, string>();

        const files = fs.readdirSync(ffDir).filter((f) => f !== "feature_block.yml");
        for (const f of files) {
            console.log(f);
            const prefix = getOffsetPrefix(ff, f);
            const fpath = path.join(ffDir, f);
            const offsets: OffsetItem[] = YAML.parse(fs.readFileSync(fpath, "utf8"));

            const newDefinitionItems = offsetsToDefinition(offsets, prefix);
            definitionItems = new Map([...definitionItems, ...newDefinitionItems]);

            pod = appendOffsets(pod, offsets, prefix);
        }

        const prefixDir = getFormatVersion(ff);
        dumpDefinition(prefixDir, definitionItems, ielibStructuresDir);
    }

    // Feature block (handled separately)
    const featureBlockPath = path.join(iesdpFileFormatsDir, "itm_v1", "feature_block.yml");
    const featureBlockOffsets: OffsetItem[] = YAML.parse(
        fs.readFileSync(featureBlockPath, "utf8")
    );
    const PREFIX_FX = "FX_";
    pod = appendOffsets(pod, featureBlockOffsets, PREFIX_FX);

    const fxDefinitionItems = offsetsToDefinition(featureBlockOffsets, PREFIX_FX);
    dumpDefinition(PREFIX_FX, fxDefinitionItems, ielibStructuresDir);

    // Add item types
    const itemTypesIsense = getItemTypesIsense(itemTypes);
    pod = {
        ...pod,
        other: [...pod.other, ...itemTypesIsense],
    };

    sanitise(pod);

    const iesdpData: IEData = {
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

    dumpCompletion(iesdpFile, iesdpData);
    dumpHighlight(highlightWeidu, iesdpData);
}

try {
    main();
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
}
