import * as fs from "fs";
import * as path from "path";
import { conlog, findFiles as findFiles, isDirectory } from "./common";
import { ProjectTraSettings } from "./settings";
import { Hover } from "vscode-languageserver/node";

interface TraEntry {
    source: string;
    hover: Hover;
    inlay: string;
}

export interface TraEntries extends Map<string, TraEntry> {}
export interface TraData extends Map<string, TraEntries> {}

export const traData: TraData = new Map();

const traLanguages = [
    "weidu-baf",
    "weidu-baf-tpl",
    "weidu-d",
    "weidu-d-tpl",
    "weidu-ssl",
    "weidu-tp2",
    "weidu-tp2-tpl",
];
const msgLanguages = ["fallout-ssl"];

export function canTranslate(langId: string) {
    if (traLanguages.includes(langId) || msgLanguages.includes(langId)) {
        return true;
    }
    return false;
}

export function getTraExt(langId: string) {
    if (traLanguages.includes(langId)) {
        return "tra";
    }
    if (msgLanguages.includes(langId)) {
        return "msg";
    }
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
        traData.set(tf, lines);
    }
    // hardly in any project there will be both tra and msg files
    const msgFiles = findFiles(tra_dir, "msg");
    for (const tf of msgFiles) {
        const lines = loadTraFile(path.join(tra_dir, tf), "msg");
        traData.set(tf, lines);
    }
}

export function reloadTraFile(traDir: string, traPath: string) {
    const lines = loadTraFile(path.join(traDir, traPath), "tra");
    traData.set(traPath, lines);
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
        const hover: Hover = {
            contents: { kind: "markdown", value: "```bgforge-mls-string\n" + `${str}` + "\n```" },
        };
        const inlay = stringToInlay(str);
        const entry = { source: str, hover: hover, inlay: inlay };
        lines.set(num, entry);
        match = regex.exec(text);
    }
    return lines;
}

export function getTraFileKey(
    fpath: string,
    fullText: string,
    settings: ProjectTraSettings,
    langId: string
) {
    const firstLine = fullText.split(/\r?\n/g)[0];
    const regex = /^\/\*\* @tra ((\w+)\.(tra|msg)) \*\//g;
    const match = regex.exec(firstLine);
    if (match) {
        return match[1];
    }
    if (settings.auto_tra) {
        const traExt = getTraExt(langId);
        const basename = path.parse(fpath).name;
        return `${basename}.${traExt}`;
    }
}

export function getTraEntries(fileKey: string) {
    const traEntries = traData.get(fileKey);
    return traEntries;
}

function getLineKey(word: string, ext: "tra" | "msg") {
    if (ext == "msg") {
        // remove "NOption(" from "NOption(123"
        const regex =
            /(Reply|NOption|GOption|BOption|mstr|display_mstr|floater|NLowOption|BLowOption|GLowOption)\((\d+)/;
        const match = regex.exec(word);
        if (match) {
            return match[2];
        }
    }
    if (ext == "tra") {
        // remove @ from tra key start, leave for msg
        return word.substring(1);
    }
}

export function isTraRef(word: string, langId: string) {
    if (traLanguages.includes(langId) && word.startsWith("@")) {
        return true;
    }
    if (msgLanguages.includes(langId) && endsWithNumber(word)) {
        return true;
    }
    return false;
}

function endsWithNumber(str: string) {
    return /[0-9]$/.test(str);
}

export function getHover(
    word: string,
    text: string,
    traSettings: ProjectTraSettings,
    relPath: string,
    langId: string
) {
    let result: Hover;

    const ext = getTraExt(langId);
    if (!ext) {
        return;
    }

    const fileKey = getTraFileKey(relPath, text, traSettings, langId);
    // if auto_tra is unset, and no tra file set in top comment
    if (!fileKey) {
        return;
    }

    const traFile = traData.get(fileKey);
    if (!traFile) {
        result = {
            contents: {
                kind: "plaintext",
                value: "Error: file " + `${fileKey}` + " not found.",
            },
        };
        return result;
    }

    const lineKey = getLineKey(word, ext);
    if (!lineKey) {
        conlog(`Error: line key ${lineKey} not found`);
        return;
    }

    const traEntry = traFile.get(lineKey);
    if (!traEntry) {
        result = {
            contents: {
                kind: "plaintext",
                value: "Error: entry " + `${lineKey}` + " not found in " + `${fileKey}.`,
            },
        };
        return result;
    }

    return traEntry.hover;
}

function stringToInlay(text: string) {
    let line: string;
    line = text.replace("\r", "");
    line = line.replace("\n", "\\n");
    if (line.length > 35) {
        line = line.slice(0, 32) + "...";
    }
    line = `/* ${line} */`;
    return line;
}
