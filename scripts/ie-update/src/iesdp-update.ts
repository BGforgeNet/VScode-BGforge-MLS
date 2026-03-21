/**
 * IESDP data update script.
 * Processes IESDP action data into BAF completion/highlight YAML files.
 */

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import YAML, { type Document, isMap } from "yaml";
import {
    actionDesc,
    actionDetail,
    appendUnique,
    cmpStr,
    createItemsSeq,
    extractTriggersFromHtml,
    findFiles,
    litscal,
    stripLiquid,
    validateActionItem,
    validateArray,
    validateIESDPGame,
} from "./ie/index.ts";
import type {
    ActionItem,
    CompletionItem,
    IESDPGame,
} from "./ie/index.ts";
import { updateHighlightStanza } from "../../utils/src/update-tp2-highlight.ts";
import { YAML_DUMP_OPTIONS } from "../../utils/src/yaml-helpers.ts";

/** IESDP base URL for documentation links */
const IESDP_BASE_URL = "https://gibberlings3.github.io/iesdp/";
/** Actions stanza key in YAML data */
const ACTIONS_STANZA = "actions";
/** Triggers stanza key in YAML data */
const TRIGGERS_STANZA = "triggers";
/** Relative path to the BGEE trigger page inside IESDP checkout */
const BGEE_TRIGGERS_PATH = "scripting/triggers/bgeetriggers.htm";

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
    const actionsHighlight = [...new Set(
        actions
            .map((x) => x.name)
            .filter((name) => !/^reserved\d*$/i.test(name))
    )];
    const actionsHighlightPatterns = actionsHighlight
        .map((x) => ({ match: `\\b(${x})\\b` }))
        .sort((a, b) => cmpStr(a.match, b.match));

    const bafHighlightDoc = YAML.parseDocument(fs.readFileSync(highlightBaf, "utf8")) as Document;
    updateHighlightStanza(bafHighlightDoc, ACTIONS_STANZA, actionsHighlightPatterns);
    fs.writeFileSync(highlightBaf, bafHighlightDoc.toString(YAML_DUMP_OPTIONS), "utf8");
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
 * Writes BAF trigger completion data to YAML file.
 */
function writeTriggersCompletion(
    dataBaf: string,
    items: readonly CompletionItem[],
): void {
    const bafDataDoc = YAML.parseDocument(fs.readFileSync(dataBaf, "utf8"));
    let triggersNode = bafDataDoc.get(TRIGGERS_STANZA, true);
    if (!isMap(triggersNode)) {
        triggersNode = bafDataDoc.createNode({ type: 3, items: [] });
        bafDataDoc.set(TRIGGERS_STANZA, triggersNode);
    }
    if (!isMap(triggersNode)) {
        throw new Error(`Expected '${TRIGGERS_STANZA}' map in ${dataBaf}`);
    }
    triggersNode.set("type", 3);
    const itemsSeq = createItemsSeq(bafDataDoc, items, true);
    triggersNode.set("items", itemsSeq);
    fs.writeFileSync(
        dataBaf,
        bafDataDoc.toString({ lineWidth: 4096, indent: 2, indentSeq: true }),
        "utf8"
    );
}

/**
 * Writes BAF highlight patterns from sorted trigger names.
 */
function writeTriggersHighlight(
    triggers: readonly CompletionItem[],
    highlightBaf: string,
): void {
    const triggerPatterns = [...new Set(triggers.map((x) => x.name))]
        .map((x) => ({ match: `\\b(${x})\\b` }))
        .sort((a, b) => cmpStr(a.match, b.match));

    const bafHighlightDoc = YAML.parseDocument(fs.readFileSync(highlightBaf, "utf8")) as Document;
    updateHighlightStanza(bafHighlightDoc, TRIGGERS_STANZA, triggerPatterns);
    fs.writeFileSync(highlightBaf, bafHighlightDoc.toString(YAML_DUMP_OPTIONS), "utf8");
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
 * Loads trigger HTML, extracts completion items, and writes BAF completion/highlight data.
 */
function processTriggers(
    iesdpDir: string,
    dataBaf: string,
    highlightBaf: string,
): void {
    const triggersFile = path.join(iesdpDir, BGEE_TRIGGERS_PATH);
    const html = fs.readFileSync(triggersFile, "utf8");
    const pageUrl = new URL(BGEE_TRIGGERS_PATH, IESDP_BASE_URL).toString();
    const triggers = extractTriggersFromHtml(html, pageUrl);

    writeTriggersHighlight(triggers, highlightBaf);
    writeTriggersCompletion(dataBaf, triggers);
}

function main(): void {
    const { values } = parseArgs({
        options: {
            s: { type: "string" },
            "data-baf": { type: "string" },
            "highlight-baf": { type: "string" },
        },
    });

    const iesdpDir = values.s;
    const dataBaf = values["data-baf"];
    const highlightBaf = values["highlight-baf"];

    if (!iesdpDir || !dataBaf || !highlightBaf) {
        console.error(
            "Usage: iesdp-update -s <iesdp_dir> --data-baf <path> --highlight-baf <path>"
        );
        process.exit(1);
    }

    processActions(iesdpDir, dataBaf, highlightBaf);
    processTriggers(iesdpDir, dataBaf, highlightBaf);
}

try {
    main();
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
}
