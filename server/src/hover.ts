import * as fs from "fs";
import * as path from "path";
import { Position } from "vscode-languageserver-textdocument";
import { Hover } from "vscode-languageserver/node";
import { conlog, findFiles as findFiles, isDirectory } from "./common";
import { ProjectTraSettings } from "./settings";

export interface HoverEx extends Hover {
    source: string;
}
export interface HoverMap extends Map<string, Hover> {}
export interface HoverMapEx extends Map<string, HoverEx> {}
export interface HoverData extends Map<string, HoverMap | HoverMapEx> {}
export interface HoverDataEx extends Map<string, HoverMapEx> {}

interface TraEntries extends Map<string, string> {}
interface TraFiles extends Map<string, TraEntries> {}

export const staticData: HoverData = new Map();
export const dynamicData: HoverDataEx = new Map();
export const selfData: HoverDataEx = new Map();
export const traData: TraFiles = new Map();

const hoverLanguages = ["weidu-tp2", "fallout-ssl", "weidu-d", "weidu-baf"];

export function loadStatic() {
    for (const langId of hoverLanguages) {
        try {
            const filePath = path.join(__dirname, `hover.${langId}.json`);
            const jsonData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
            const hoverData: Map<string, Hover> = new Map(Object.entries(jsonData));
            staticData.set(langId, hoverData);
        } catch (e) {
            conlog(e);
        }
    }
}

function onlyDigits(value: string) {
    return /^\d+$/.test(value);
}

/** get word under cursor, for which we want to find a hover */
export function symbolAtPosition(text: string, position: Position) {
    const lines = text.split(/\r?\n/g);
    const str = lines[position.line];
    const pos = position.character;

    // Search for the word's beginning and end.
    let left = str.slice(0, pos + 1).search(/\w+$/),
        right = str.slice(pos).search(/\W/);

    let result: string;
    // The last word in the string is a special case.
    if (right < 0) {
        result = str.slice(left);
    } else {
        // Return the word, using the located bounds to extract it from the string.
        result = str.slice(left, right + pos);
    }

    // if a proper symbol, return
    if (!onlyDigits(result)) {
        return result;
    }

    // and if pure numeric, check if it's a tra reference
    if (onlyDigits(result)) {
        left = str.slice(0, pos + 1).search(/\S+$/);
        right = str.slice(pos).search(/\W/);
        if (right < 0) {
            result = str.slice(left);
        } else {
            result = str.slice(left, right + pos);
        }
    }

    return result;
}

/** Loads all tra files in a directory to a map of maps of strings */
export function loadTranslation(traSettings: ProjectTraSettings) {
    const tra_dir = traSettings.directory;
    if (!isDirectory(tra_dir)) {
        conlog(`${tra_dir} is not a directory, aborting tra load`);
        return;
    }
    const traFiles = findFiles(tra_dir, "tra");
    for (const tf of traFiles) {
        const lines = loadTraFile(path.join(tra_dir, tf), "tra");
        const traKey = tf.slice(0, -4);
        traData.set(traKey, lines);
    }
    // hardly in any project there will be both tra and msg files
    const msgFiles = findFiles(tra_dir, "msg");
    for (const tf of msgFiles) {
        const lines = loadTraFile(path.join(tra_dir, tf), "msg");
        const traKey = tf.slice(0, -4);
        traData.set(traKey, lines);
    }
}

export function reloadTraFile(traDir: string, traPath: string) {
    const lines = loadTraFile(path.join(traDir, traPath), "tra");
    const traKey = traPath.slice(0, -4);
    traData.set(traKey, lines);
    conlog(`reloaded ${traDir} / ${traPath}`);
}

/** Loads a .tra file and return a map of num > string */
function loadTraFile(fpath: string, traType: "tra" | "msg") {
    const text = fs.readFileSync(fpath, "utf8");
    let regex: RegExp;
    if (traType == "tra") {
        regex = /@(\d+)\s*=\s*~([^~]*)~/gm;
    } else {
        regex = /{(\d+)}\s*{\w*}\s*{([^}]*)}/gm;
    }
    const lines: TraEntries = new Map();
    let match = regex.exec(text);
    while (match != null) {
        if (match.index === regex.lastIndex) {
            regex.lastIndex++;
        }
        const num = match[1];
        const str = match[2];
        lines.set(num, str);
        match = regex.exec(text);
    }
    return lines;
}

function getTraFileKey(fpath: string, fullText: string, settings: ProjectTraSettings) {
    const firstLine = fullText.split(/\r?\n/g)[0];
    const regex = /^\/\*\* mls.tra: ([\w-]+)\.tra \*\//gm;
    const match = regex.exec(firstLine);
    if (match) {
        return match[1];
    }
    if (settings.auto_tra) {
        return path.parse(fpath).name;
    }
}

export function getTraFor(
    id: string,
    fullText: string,
    settings: ProjectTraSettings,
    fpath: string,
    traType: "tra" | "msg" = "tra"
) {
    const fileKey = getTraFileKey(fpath, fullText, settings);
    const traFile = traData.get(fileKey);
    let result: Hover;

    if (!traFile) {
        result = {
            contents: {
                kind: "plaintext",
                value: "Error: file " + `${fileKey}.${traType}` + " not found.",
            },
        };
        return result;
    }

    // remove @ from tra key start, leave for msg
    if (traType != "msg") {
        id = id.substring(1);
    }

    const tra = traFile.get(id);
    if (!tra) {
        result = {
            contents: {
                kind: "plaintext",
                value: "Error: entry " + `${id}` + " not found in " + `${fileKey}.${traType}.`,
            },
        };
        return result;
    }

    result = {
        contents: { kind: "markdown", value: "```bgforge-mls-string\n" + `${tra}` + "\n```" },
    };
    return result;
}

export function get_msg_for(
    id: string,
    full_text: string,
    settings: ProjectTraSettings,
    fpath: string
) {
    const regex = /(Reply|NOption|GOption|BOption|mstr|display_mstr|floater)\((\d+)/;
    const match = regex.exec(id);
    if (match) {
        const result = getTraFor(match[2], full_text, settings, fpath, "msg");
        return result;
    }
}
