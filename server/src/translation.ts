import PromisePool from "@supercharge/promise-pool";
import * as fs from "fs";
import * as path from "path";
import { Hover } from "vscode-languageserver/node";
import { conlog, findFiles, getRelPath, isDirectory, isSubpath } from "./common";
import { ProjectTraSettings } from "./settings";

interface TraEntry {
    source: string;
    hover: Hover;
    inlay: string;
    inlayTooltip?: string;
}

/** Single file: index => entry */
export interface TraEntries extends Map<string, TraEntry> {}
/** Relative file: path => entries */
export interface TraData extends Map<string, TraEntries> {}
export interface Translation {
    directory: string;
    data: TraData;
    settings: ProjectTraSettings;
    initialized: boolean;
}

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

export const translatableLanguages = [...traLanguages, ...msgLanguages];

export const languages = ["fallout-msg", "weidu-tra"];
export const extensions: Array<TraExt> = ["msg", "tra"];

export function getTraExt(langId: string) {
    if (traLanguages.includes(langId)) {
        return "tra";
    }
    if (msgLanguages.includes(langId)) {
        return "msg";
    }
}

export type TraExt = "msg" | "tra";

export class Translation implements Translation {
    directory: string;
    data: TraData;
    settings: ProjectTraSettings;
    initialized: boolean;

    constructor(settings: ProjectTraSettings) {
        conlog("initializing translation");
        this.settings = settings;
        this.directory = settings.directory;
        this.initialized = false;
        this.data = new Map();
    }

    async init() {
        this.data = await this.loadDir(this.settings.directory);
        this.initialized = true;
        conlog("initialized");
    }

    /** Loads all tra files in a directory to a map of maps of strings */
    async loadDir(traDir: string) {
        const traData: TraData = new Map();
        if (!isDirectory(traDir)) {
            conlog(`${traDir} is not a directory, aborting tra load`);
            return traData;
        }

        for (const ext of extensions) {
            const traFiles = findFiles(traDir, ext);
            const { results, errors } = await this.loadFiles(traDir, traFiles, ext);
            if (errors.length > 0) {
                conlog(errors);
            }
            results.map((x) => {
                for (const [key, value] of x) {
                    traData.set(key, value);
                }
            });
        }
        return traData;
    }

    // load multiple files in parallel
    private async loadFiles(traDir: string, files: string[], ext: TraExt) {
        const { results, errors } = await PromisePool.withConcurrency(4)
            .for(files)
            .process(async (relPath) => {
                const result: TraData = new Map();
                const text = fs.readFileSync(path.join(traDir, relPath), "utf8");
                const lines = this.linesFromText(text, ext);
                result.set(relPath, lines);
                return result;
            });
        return { results, errors };
    }

    /** Parses text and returns a map of index > string */
    linesFromText(text: string, traType: TraExt) {
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
                contents: {
                    kind: "markdown",
                    value: "```bgforge-mls-string\n" + `${str}` + "\n```",
                },
            };
            const inlay = stringToInlay(str);
            const entry: TraEntry = { source: str, hover: hover, inlay: inlay };
            if (str != inlay) {
                entry.inlayTooltip = str;
            }
            lines.set(num, entry);
            match = regex.exec(text);
        }
        return lines;
    }

    /** wsPath must be relative to workspace root */
    reloadFileLines(wsPath: string, text: string) {
        const traPath = this.getTraPath(wsPath);
        if (!traPath) {
            conlog(`Error: can't detect tra file path for ${wsPath}, aborting translation reload.`);
            return;
        }
        const ext = path.parse(traPath).ext.slice(-3);
        if (ext != "tra" && ext != "msg") {
            conlog(`Unknown traslation file extension ${ext}.`);
            return;
        }
        const lines = this.linesFromText(text, ext);
        this.data.set(traPath, lines);
        conlog(`Translation: reloaded ${this.directory} / ${traPath}`);
    }

    /**
     * @arg wsPath must be relative to workspace root
     * @ret path relative to tra dir
     */
    getTraPath(wsPath: string) {
        if (isDirectory(this.directory)) {
            if (isSubpath(this.directory, wsPath)) {
                const relPath = getRelPath(this.directory, wsPath);
                return relPath;
            }
        }
    }

    entries(fileKey: string) {
        return this.data.get(fileKey);
    }

    /** only basename matters in filePath
     */
    traFileKey(filePath: string, fullText: string, langId: string) {
        const firstLine = fullText.split(/\r?\n/g)[0];
        const regex = /^\/\*\* @tra ((\w+)\.(tra|msg)) \*\//g;
        const match = regex.exec(firstLine);
        if (match) {
            return match[1];
        }
        if (this.settings.auto_tra) {
            const traExt = getTraExt(langId);
            const basename = path.parse(filePath).name;
            return `${basename}.${traExt}`;
        }
    }

    hover(word: string, text: string, relPath: string, langId: string) {
        let result: Hover;

        const ext = getTraExt(langId);
        if (!ext) {
            return;
        }

        const fileKey = this.traFileKey(relPath, text, langId);
        // if auto_tra is unset, and no tra file set in top comment
        if (!fileKey) {
            return;
        }

        const traFile = this.data.get(fileKey);
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

function stringToInlay(text: string) {
    let line: string;
    line = text.replace("\r", "");
    line = line.replace("\n", "\\n");
    if (line.length > 30) {
        line = line.slice(0, 27) + "...";
    }
    line = `/* ${line} */`;
    return line;
}
