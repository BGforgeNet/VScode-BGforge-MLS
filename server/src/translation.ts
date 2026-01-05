/**
 * Translation service for .tra and .msg files.
 * Self-contained service that loads translations and provides hover/inlay hints.
 * Can be used by any consumer (providers, TSSL/TBAF handlers, etc.)
 */

import PromisePool from "@supercharge/promise-pool";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { Hover, InlayHint, Range } from "vscode-languageserver/node";
import { conlog, findFiles, getRelPath, isDirectory, isSubpath } from "./common";
import {
    LANG_FALLOUT_SSL,
    MSG_LANGUAGES,
    TRANSLATION_FILE_LANGUAGES,
    TRANSLATION_LANGUAGES,
} from "./core/languages";
import { ProjectTraSettings } from "./settings";

interface TraEntry {
    source: string;
    hover: Hover;
    inlay: string;
    inlayTooltip?: string;
}

/** Single file: index => entry */
interface TraEntries extends Map<string, TraEntry> {}
/** Relative file: path => entries */
interface TraData extends Map<string, TraEntries> {}

type TraExt = "msg" | "tra";

/** Languages that contain translation strings (msg/tra files) */
const languages = TRANSLATION_FILE_LANGUAGES;

/** Languages that can have translation references */
const translatableLanguages = [...TRANSLATION_LANGUAGES, ...MSG_LANGUAGES];

const extensions: Array<TraExt> = ["msg", "tra"];

const regexMsg =
    /^(Reply|NOption|GOption|BOption|mstr|display_mstr|floater|NLowOption|BLowOption|GLowOption|GMessage|NMessage|BMessage|CompOption)\((\d+)$/;
const regexTra = /^@[0-9]+$/;

/** Check if a symbol is a translation reference for the given language */
function isTraRef(word: string, langId: string): boolean {
    if (TRANSLATION_LANGUAGES.includes(langId) && word.match(regexTra)) {
        return true;
    }
    if (MSG_LANGUAGES.includes(langId) && word.match(regexMsg)) {
        return true;
    }
    return false;
}

export class Translation {
    private directory: string;
    private data: TraData;
    private settings: ProjectTraSettings;
    private workspaceRoot: string;
    initialized: boolean;

    constructor(settings: ProjectTraSettings, workspaceRoot: string) {
        conlog("Translation: initializing");
        this.settings = settings;
        this.directory = settings.directory;
        this.workspaceRoot = workspaceRoot;
        this.initialized = false;
        this.data = new Map();
    }

    async init(): Promise<void> {
        this.data = await this.loadDir(this.settings.directory);
        this.initialized = true;
        conlog("Translation: initialized");
    }

    // =========================================================================
    // Public API
    // =========================================================================

    /**
     * Get hover for a translation reference.
     * @param uri - Document URI
     * @param langId - Language ID
     * @param symbol - The symbol under cursor (e.g., "@123" or "NOption(123")
     * @param text - Full document text
     * @returns Hover or null if not a translation reference
     */
    getHover(uri: string, langId: string, symbol: string, text: string): Hover | null {
        if (!this.initialized) return null;
        if (!translatableLanguages.includes(langId)) return null;
        if (!isTraRef(symbol, langId)) return null;

        const filePath = this.uriToPath(uri);
        if (!isSubpath(this.workspaceRoot, filePath)) return null;

        const relPath = getRelPath(this.workspaceRoot, filePath);
        return this.lookupHover(symbol, text, relPath, langId);
    }

    /**
     * Get inlay hints for translation references in visible range.
     * @param uri - Document URI
     * @param langId - Language ID
     * @param text - Full document text
     * @param range - Visible range to generate hints for
     * @returns Array of inlay hints
     */
    getInlayHints(uri: string, langId: string, text: string, range: Range): InlayHint[] {
        if (!this.initialized) return [];

        const filePath = this.uriToPath(uri);
        const traFileKey = this.resolveTraFileKey(filePath, text, langId);
        if (!traFileKey) return [];

        const traEntries = this.data.get(traFileKey);
        if (!traEntries) return [];

        const traExt = this.getTraExt(langId);
        if (!traExt) return [];

        return this.generateInlayHints(traFileKey, traEntries, traExt, text, range);
    }

    /**
     * Reload translation data if the file is a translation file.
     * Call this on document open/save for translation files.
     * @param uri - Document URI
     * @param langId - Language ID
     * @param text - Full document text
     */
    reloadFile(uri: string, langId: string, text: string): void {
        if (!this.initialized) return;
        if (!languages.includes(langId)) return;

        const filePath = this.uriToPath(uri);
        if (!isSubpath(this.workspaceRoot, filePath)) return;

        const wsPath = getRelPath(this.workspaceRoot, filePath);
        this.reloadFileLines(wsPath, text);
    }

    /**
     * Get all message texts for a file (used for dialog parsing).
     * @param uri - Document URI
     * @param text - Full document text
     * @returns Map of message ID to message text
     */
    getMessages(uri: string, text: string): Record<string, string> {
        const messages: Record<string, string> = {};
        if (!this.initialized) return messages;

        const filePath = this.uriToPath(uri);
        const traFileKey = this.resolveTraFileKey(filePath, text, LANG_FALLOUT_SSL);
        if (!traFileKey) return messages;

        const traEntries = this.data.get(traFileKey);
        if (!traEntries) return messages;

        for (const [id, entry] of traEntries) {
            messages[id] = entry.source;
        }
        return messages;
    }

    // =========================================================================
    // Internal methods
    // =========================================================================

    private uriToPath(uri: string): string {
        return uri.startsWith("file://") ? fileURLToPath(uri) : uri;
    }

    private getTraExt(langId: string): TraExt | undefined {
        if (TRANSLATION_LANGUAGES.includes(langId)) {
            return "tra";
        }
        if (MSG_LANGUAGES.includes(langId)) {
            return "msg";
        }
        return undefined;
    }

    /** Loads all tra files in a directory to a map of maps of strings */
    private async loadDir(traDir: string): Promise<TraData> {
        const traData: TraData = new Map();
        if (!isDirectory(traDir)) {
            conlog(`Translation: ${traDir} is not a directory, skipping`);
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

    private async loadFiles(traDir: string, files: string[], ext: TraExt) {
        const { results, errors } = await PromisePool.withConcurrency(4)
            .for(files)
            .process(async (relPath) => {
                const result: TraData = new Map();
                const text = fs.readFileSync(path.join(traDir, relPath), "utf8");
                const lines = this.parseEntries(text, ext);
                result.set(relPath, lines);
                return result;
            });
        return { results, errors };
    }

    /** Parses text and returns a map of index => entry */
    private parseEntries(text: string, traType: TraExt): TraEntries {
        let regex: RegExp;
        if (traType == "tra") {
            regex = /@(\d+)\s*=\s*~([^~]*)~/gm;
        } else {
            regex = /{(\d+)}\s*{\w*}\s*{([^}]*)}/gm;
        }
        const entries: TraEntries = new Map();
        let match = regex.exec(text);
        while (match != null) {
            if (match.index === regex.lastIndex) {
                regex.lastIndex++;
            }
            const num = match[1];
            const str = match[2];
            if (!num || !str) {
                match = regex.exec(text);
                continue;
            }
            const hover: Hover = {
                contents: {
                    kind: "markdown",
                    value: "```bgforge-mls-string\n" + `${str}` + "\n```",
                },
            };
            const inlay = this.stringToInlay(str);
            const entry: TraEntry = { source: str, hover: hover, inlay: inlay };
            if (`/* ${str} */` != inlay) {
                entry.inlayTooltip = str;
            }
            entries.set(num, entry);
            match = regex.exec(text);
        }
        return entries;
    }

    private reloadFileLines(wsPath: string, text: string): void {
        const traPath = this.getTraPath(wsPath);
        if (!traPath) {
            conlog(`Translation: can't detect tra path for ${wsPath}, skipping reload`);
            return;
        }
        const ext = path.parse(traPath).ext.slice(-3);
        if (ext != "tra" && ext != "msg") {
            conlog(`Translation: unknown extension ${ext}`);
            return;
        }
        const entries = this.parseEntries(text, ext as TraExt);
        this.data.set(traPath, entries);
        conlog(`Translation: reloaded ${traPath}`);
    }

    /** Convert workspace-relative path to tra-directory-relative path */
    private getTraPath(wsPath: string): string | undefined {
        if (isDirectory(this.directory)) {
            if (isSubpath(this.directory, wsPath)) {
                return getRelPath(this.directory, wsPath);
            }
        }
        return undefined;
    }

    /**
     * Resolve the translation file key for a source file.
     * Checks for @tra comment first, falls back to auto-matching by basename.
     */
    private resolveTraFileKey(filePath: string, fullText: string, langId: string): string | undefined {
        const firstLine = fullText.split(/\r?\n/g)[0];
        if (!firstLine) return undefined;

        const regex = /^\/\*\* @tra ((\w+)\.(tra|msg)) \*\//g;
        const match = regex.exec(firstLine);
        if (match && match[1]) {
            return match[1];
        }
        if (this.settings.auto_tra) {
            const traExt = this.getTraExt(langId);
            if (!traExt) return undefined;
            const basename = path.parse(filePath).name;
            return `${basename}.${traExt}`;
        }
        return undefined;
    }

    private lookupHover(word: string, text: string, relPath: string, langId: string): Hover | null {
        const ext = this.getTraExt(langId);
        if (!ext) return null;

        const fileKey = this.resolveTraFileKey(relPath, text, langId);
        if (!fileKey) return null;

        const traFile = this.data.get(fileKey);
        if (!traFile) {
            return {
                contents: {
                    kind: "plaintext",
                    value: `Error: file ${fileKey} not found.`,
                },
            };
        }

        const lineKey = this.getLineKey(word, ext);
        if (!lineKey) {
            conlog(`Translation: line key not found for ${word}`);
            return null;
        }

        const traEntry = traFile.get(lineKey);
        if (!traEntry) {
            return {
                contents: {
                    kind: "plaintext",
                    value: `Error: entry ${lineKey} not found in ${fileKey}.`,
                },
            };
        }

        return traEntry.hover;
    }

    private getLineKey(word: string, ext: TraExt): string | undefined {
        if (ext == "msg") {
            const match = regexMsg.exec(word);
            if (match) {
                return match[2];
            }
        }
        if (ext == "tra") {
            return word.substring(1);
        }
        return undefined;
    }

    private generateInlayHints(
        traFileKey: string,
        traEntries: TraEntries,
        traExt: TraExt,
        text: string,
        range: Range
    ): InlayHint[] {
        const hints: InlayHint[] = [];

        let lines = text.split("\n");
        lines = lines.slice(range.start.line, range.end.line);

        let regex: RegExp;
        if (traExt == "msg") {
            regex =
                /(Reply|NOption|GOption|BOption|mstr|display_mstr|floater|NLowOption|BLowOption|GLowOption|GMessage|NMessage|BMessage|CompOption)\((\d+)/g;
        } else {
            regex = /@(\d+)/g;
        }

        lines.forEach((l, i) => {
            const matches = l.matchAll(regex);
            for (const m of matches) {
                if (!m.index) continue;

                const char_end = m.index + m[0].length;
                let lineKey: string | undefined;
                if (traExt == "msg") {
                    lineKey = m[2];
                } else {
                    lineKey = m[1];
                }
                if (!lineKey) continue;

                const pos = { line: range.start.line + i, character: char_end };
                const hintValue = this.getHintValue(traEntries, traFileKey, lineKey);
                const hint: InlayHint = {
                    position: pos,
                    label: hintValue.label,
                    tooltip: hintValue.tooltip,
                    kind: 2,
                    paddingLeft: true,
                    paddingRight: true,
                };
                hints.push(hint);
            }
        });
        return hints;
    }

    private getHintValue(
        traEntries: TraEntries,
        traFileKey: string,
        lineKey: string
    ): { label: string; tooltip?: string } {
        const traEntry = traEntries.get(lineKey);
        if (traEntry === undefined) {
            return { label: `/* Error: no such string ${traFileKey}:${lineKey} */`, tooltip: "" };
        }
        return {
            label: traEntry.inlay,
            tooltip: traEntry.inlayTooltip ?? "",
        };
    }

    private stringToInlay(text: string): string {
        let line = text.replace("\r", "");
        line = line.replace("\n", "\\n");
        if (line.length > 30) {
            line = line.slice(0, 27) + "...";
        }
        return `/* ${line} */`;
    }
}
