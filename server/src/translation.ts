/**
 * Translation service for .tra and .msg files.
 * Self-contained service that loads translations and provides hover/inlay hints.
 * Can be used by any consumer (providers, TSSL/TBAF handlers, etc.)
 */

import PromisePool from "@supercharge/promise-pool";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { Hover, InlayHint, MarkupContent, MarkupKind, Range } from "vscode-languageserver/node";
import { conlog, findFiles, getRelPath, isDirectory, isSubpath } from "./common";
import {
    EXT_TBAF,
    EXT_TD,
    EXT_TSSL,
    LANG_FALLOUT_SSL,
    LANG_TYPESCRIPT,
    MSG_LANGUAGES,
    TRA_LANGUAGES,
    TRANSLATION_FILE_LANGUAGES,
} from "./core/languages";
import {
    REGEX_MSG_HOVER,
    REGEX_MSG_INLAY,
    REGEX_TBAF_HOVER,
    REGEX_TBAF_INLAY,
    REGEX_TD_HOVER,
    REGEX_TD_INLAY,
    REGEX_TRA_COMMENT,
    REGEX_TRA_COMMENT_EXT,
    REGEX_TRA_HOVER,
    REGEX_TRA_INLAY,
} from "./core/patterns";
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
const translatableLanguages = [...TRA_LANGUAGES, ...MSG_LANGUAGES];

const extensions: Array<TraExt> = ["msg", "tra"];

/**
 * Check if a symbol is a translation reference for the given language.
 * For typescript files, also checks file extension to determine format.
 */
function isTraRef(word: string, langId: string, filePath?: string): boolean {
    // For typescript, determine pattern by file extension
    if (langId === LANG_TYPESCRIPT && filePath) {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === EXT_TSSL) {
            return !!word.match(REGEX_MSG_HOVER);
        }
        if (ext === EXT_TBAF) {
            return !!word.match(REGEX_TBAF_HOVER);
        }
        if (ext === EXT_TD) {
            return !!word.match(REGEX_TD_HOVER);
        }
        // Regular .ts file - check all patterns, format determined by @tra comment
        return !!word.match(REGEX_MSG_HOVER) || !!word.match(REGEX_TBAF_HOVER) || !!word.match(REGEX_TD_HOVER);
    }

    // For other languages, check the language arrays
    if (TRA_LANGUAGES.includes(langId) && word.match(REGEX_TRA_HOVER)) {
        return true;
    }
    if (MSG_LANGUAGES.includes(langId) && word.match(REGEX_MSG_HOVER)) {
        return true;
    }
    return false;
}

export class Translation {
    private directory: string;
    private data: TraData;
    private settings: ProjectTraSettings;
    private workspaceRoot: string | undefined;
    initialized: boolean;

    constructor(settings: ProjectTraSettings, workspaceRoot: string | undefined) {
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
        if (this.data.size === 0) return null;
        if (!translatableLanguages.includes(langId)) return null;

        const filePath = this.uriToPath(uri);
        const wsRoot = this.workspaceRoot;
        if (wsRoot === undefined || !isSubpath(wsRoot, filePath)) return null;
        if (!isTraRef(symbol, langId, filePath)) return null;

        const relPath = getRelPath(wsRoot, filePath);
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
        if (this.data.size === 0) return [];

        const filePath = this.uriToPath(uri);
        const traFileKey = this.resolveTraFileKey(filePath, text, langId);
        if (!traFileKey) return [];

        const traEntries = this.data.get(traFileKey);
        if (!traEntries) return [];

        const traExt = this.getTraExt(langId, filePath, text);
        if (!traExt) return [];

        return this.generateInlayHints(traFileKey, traEntries, traExt, text, range, filePath);
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
        const wsRoot = this.workspaceRoot;
        if (wsRoot === undefined || !isSubpath(wsRoot, filePath)) return;

        const wsPath = getRelPath(wsRoot, filePath);
        this.reloadFileLines(wsPath, text);
    }

    /**
     * Get all message texts for a file (used for dialog parsing).
     * @param uri - Document URI
     * @param text - Full document text
     * @param langId - Language ID (determines .msg vs .tra resolution)
     * @returns Map of message ID to message text
     */
    getMessages(uri: string, text: string, langId: string = LANG_FALLOUT_SSL): Record<string, string> {
        const messages: Record<string, string> = {};
        if (!this.initialized) return messages;

        const filePath = this.uriToPath(uri);
        const traFileKey = this.resolveTraFileKey(filePath, text, langId);
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

    /**
     * Determine translation file extension based on language and file path.
     * For typescript files, checks .tssl (msg) vs .tbaf (tra) extension.
     * For regular .ts files, infers from @tra comment or loaded translation files.
     */
    private getTraExt(langId: string, filePath?: string, text?: string): TraExt | undefined {
        // For typescript, determine by file extension
        if (langId === LANG_TYPESCRIPT && filePath) {
            const ext = path.extname(filePath).toLowerCase();
            if (ext === EXT_TSSL) {
                return "msg";
            }
            if (ext === EXT_TBAF || ext === EXT_TD) {
                return "tra";
            }
            // Regular .ts file - infer from @tra comment first
            if (text) {
                const traFileExt = this.getTraFileExtFromComment(text);
                if (traFileExt) {
                    return traFileExt;
                }
            }
            // No @tra comment - infer from loaded translation files (msg and tra are never mixed)
            for (const key of this.data.keys()) {
                if (key.endsWith(".msg")) return "msg";
                if (key.endsWith(".tra")) return "tra";
            }
            return undefined;
        }

        // For other languages, check the language arrays
        // Check MSG_LANGUAGES first since it's more specific
        if (MSG_LANGUAGES.includes(langId)) {
            return "msg";
        }
        if (TRA_LANGUAGES.includes(langId)) {
            return "tra";
        }
        return undefined;
    }

    /**
     * Extract translation file extension from @tra comment.
     * Returns "msg" or "tra" based on the referenced file extension.
     */
    private getTraFileExtFromComment(text: string): TraExt | undefined {
        const firstLine = text.split(/\r?\n/g)[0];
        if (!firstLine) return undefined;

        const match = REGEX_TRA_COMMENT_EXT.exec(firstLine);
        if (match && match[1]) {
            return match[1] as TraExt;
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
                const text = await fs.promises.readFile(path.join(traDir, relPath), "utf8");
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
            // Check undefined only -- empty string is a valid translation entry (e.g., @0 = ~~)
            if (num === undefined || str === undefined) {
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

        const match = REGEX_TRA_COMMENT.exec(firstLine);
        if (match && match[1]) {
            return match[1];
        }
        if (this.settings.auto_tra) {
            const traExt = this.getTraExt(langId, filePath, fullText);
            if (!traExt) return undefined;
            const basename = path.parse(filePath).name;
            return `${basename}.${traExt}`;
        }
        return undefined;
    }

    private lookupHover(word: string, text: string, relPath: string, langId: string): Hover | null {
        const ext = this.getTraExt(langId, relPath, text);
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
            const match = REGEX_MSG_HOVER.exec(word);
            if (match) {
                return match[2];
            }
        }
        if (ext == "tra") {
            // Check for TBAF $tra(123) format
            const tbafMatch = REGEX_TBAF_HOVER.exec(word);
            if (tbafMatch) {
                return tbafMatch[1];
            }
            // Check for TD tra(123) format
            const tdMatch = REGEX_TD_HOVER.exec(word);
            if (tdMatch) {
                return tdMatch[1];
            }
            // Standard @123 format
            return word.substring(1);
        }
        return undefined;
    }

    private generateInlayHints(
        traFileKey: string,
        traEntries: TraEntries,
        traExt: TraExt,
        text: string,
        range: Range,
        filePath: string
    ): InlayHint[] {
        const hints: InlayHint[] = [];

        let lines = text.split("\n");
        lines = lines.slice(range.start.line, range.end.line);

        // Determine regex based on file type
        // keyIndex: which capture group contains the translation ID
        let regex: RegExp;
        let keyIndex: number;
        if (traExt == "msg") {
            regex = new RegExp(REGEX_MSG_INLAY.source, "g");
            keyIndex = 2;
        } else {
            // TypeScript files use different patterns based on extension:
            // - .tbaf uses $tra(123)
            // - .td uses tra(123)
            // - .ts uses $tra(123) (default)
            // Native WeiDU files (baf, d, tp2) use @123 syntax
            const ext = path.extname(filePath).toLowerCase();
            if (ext === EXT_TBAF || ext === ".ts") {
                regex = new RegExp(REGEX_TBAF_INLAY.source, "g");
            } else if (ext === EXT_TD) {
                regex = new RegExp(REGEX_TD_INLAY.source, "g");
            } else {
                regex = new RegExp(REGEX_TRA_INLAY.source, "g");
            }
            keyIndex = 1;
        }

        // NOTE: This works because we split by newlines first, so each line element is
        // guaranteed single-line. If future patterns need multiline matching, this would
        // need byte-offset-to-position conversion like in weidu-tp2/rename.ts.
        lines.forEach((l, i) => {
            const matches = l.matchAll(regex);
            for (const m of matches) {
                // matchAll always provides index for each match
                const char_end = m.index! + m[0].length;
                const lineKey = m[keyIndex];
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
    ): { label: string; tooltip?: string | MarkupContent } {
        const traEntry = traEntries.get(lineKey);
        if (traEntry === undefined) {
            return { label: `/* Error: no such string ${traFileKey}:${lineKey} */`, tooltip: "" };
        }
        const tooltip = traEntry.inlayTooltip
            ? { kind: MarkupKind.Markdown, value: "```bgforge-mls-string\n" + traEntry.inlayTooltip + "\n```" }
            : undefined;
        return {
            label: traEntry.inlay,
            tooltip,
        };
    }

    private stringToInlay(text: string): string {
        let line = text.replaceAll("\r", "");
        line = line.replaceAll("\n", "\\n");
        // Escape */ to prevent breaking the inlay comment syntax
        line = line.replaceAll("*/", "*\\/");
        if (line.length > 30) {
            line = line.slice(0, 27) + "...";
        }
        return `/* ${line} */`;
    }
}
