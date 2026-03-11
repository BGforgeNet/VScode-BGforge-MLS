/**
 * WeiDU D language provider.
 * Implements all D file features in one place.
 *
 * Uses unified Symbols storage for completion and hover data.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CompletionItem, DocumentSymbol, FoldingRange, Location, Position } from "vscode-languageserver/node";
import { conlog, findFiles, pathToUri } from "../common";
import { EXT_WEIDU_D, LANG_WEIDU_D } from "../core/languages";
import type { IndexedSymbol } from "../core/symbol";
import { FileIndex } from "../core/file-index";
import { loadStaticSymbols } from "../core/static-loader";
import { type FormatResult, type LanguageProvider, type ProviderContext } from "../language-provider";
import { stripCommentsWeidu } from "../shared/format-utils";
import { getFormatOptions } from "../shared/format-options";
import { resolveSymbolStatic, getStaticCompletions, formatWithValidation } from "../shared/provider-helpers";
import { isInsideComment } from "./ast-utils";
import { parseFile } from "./file-parser";
import { getDefinition } from "./definition";
import { getStateLabelHover } from "./hover";
import { findReferences } from "./references";
import { prepareRenameSymbol, renameSymbol } from "./rename";
import { formatDocument as formatAst } from "./format/core";
import { initParser, parseWithCache, isInitialized } from "./parser";
import { getDocumentSymbols } from "./symbol";
import { compile as weiduCompile } from "../weidu-compile";
import { createFoldingRangesProvider } from "../shared/folding-ranges";
import { SyntaxType } from "./tree-sitter.d";

/** D block-level node types for code folding. */
const D_FOLDABLE_TYPES = new Set([
    SyntaxType.BeginAction,
    SyntaxType.AppendAction,
    SyntaxType.ChainAction,
    SyntaxType.ExtendAction,
    SyntaxType.InterjectAction,
    SyntaxType.InterjectCopyTrans,
    SyntaxType.ReplaceAction,
    SyntaxType.State,
    SyntaxType.Transition,
]);

const dFoldingRanges = createFoldingRangesProvider(isInitialized, parseWithCache, D_FOLDABLE_TYPES);

class WeiduDProvider implements LanguageProvider {
    readonly id = LANG_WEIDU_D;
    // D files are primary source files, not headers. watchExtensions is not set
    // because scanWorkspaceHeaders uses readFileSync — we do our own async scan
    // in init() instead, following the SSL provider pattern.

    private fileIndex: FileIndex | undefined;
    private storedContext: ProviderContext | undefined;

    async init(context: ProviderContext): Promise<void> {
        this.storedContext = context;

        await initParser();

        this.fileIndex = new FileIndex();
        const staticSymbols = loadStaticSymbols(LANG_WEIDU_D);
        this.fileIndex.loadStatic(staticSymbols);

        // Build references index from all .d files in the workspace (async I/O)
        if (context.workspaceRoot) {
            await this.scanWorkspaceFiles(context.workspaceRoot);
        }

        conlog(`WeiDU D provider initialized with ${staticSymbols.length} static symbols`);
    }

    /**
     * Scan workspace for all .d files and populate the references index.
     * Uses async I/O to avoid blocking the event loop at startup.
     */
    private async scanWorkspaceFiles(workspaceRoot: string): Promise<void> {
        const ext = EXT_WEIDU_D.slice(1); // ".d" -> "d"
        const relativePaths = findFiles(workspaceRoot, ext);

        const results = await Promise.allSettled(
            relativePaths.map(async (relativePath) => {
                const absolutePath = join(workspaceRoot, relativePath);
                const uri = pathToUri(absolutePath);
                const text = await readFile(absolutePath, "utf-8");
                if (this.fileIndex) {
                    const result = parseFile(uri, text);
                    this.fileIndex.updateFile(uri, result);
                }
            }),
        );

        const fulfilled = results.filter(r => r.status === "fulfilled").length;
        const firstRejected = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
        const rejectedCount = results.length - fulfilled;
        if (fulfilled > 0 || rejectedCount > 0) {
            const warning = firstRejected
                ? ` (${rejectedCount} failed, first: ${firstRejected.reason})`
                : "";
            conlog(`D references index: indexed ${fulfilled} files${warning}`);
        }
    }

    shouldProvideFeatures(text: string, position: Position): boolean {
        return !isInsideComment(text, position);
    }

    // D files have state labels but no user-defined functions/macros.
    // Symbol lookup is static-only (YAML data: actions + triggers).
    resolveSymbol(name: string, _text: string, _uri: string): IndexedSymbol | undefined {
        return resolveSymbolStatic(name, this.fileIndex?.symbols);
    }

    format(text: string, uri: string): FormatResult {
        return formatWithValidation({
            text,
            uri,
            languageName: "D",
            isInitialized,
            parse: parseWithCache,
            formatAst: (rootNode, options) => formatAst(rootNode, options),
            getFormatOptions,
            stripComments: stripCommentsWeidu,
        });
    }

    symbols(text: string): DocumentSymbol[] {
        return getDocumentSymbols(text);
    }

    foldingRanges(text: string): FoldingRange[] {
        return dFoldingRanges(text);
    }

    definition(text: string, position: Position, uri: string): Location | null {
        return getDefinition(text, uri, position);
    }

    references(text: string, position: Position, uri: string, includeDeclaration: boolean): Location[] {
        if (!isInitialized()) {
            return [];
        }
        return findReferences(text, position, uri, includeDeclaration, this.fileIndex?.refs);
    }

    prepareRename(text: string, position: Position) {
        return prepareRenameSymbol(text, position);
    }

    rename(text: string, position: Position, newName: string, uri: string) {
        return renameSymbol(text, position, newName, uri);
    }

    hover(text: string, symbol: string, uri: string, position: Position) {
        return getStateLabelHover(text, symbol, uri, position);
    }

    getCompletions(_uri: string): CompletionItem[] {
        return getStaticCompletions(this.fileIndex?.symbols);
    }

    // Called by server.ts onDidChangeContent/onDidSave for open documents.
    // Not called via scanWorkspaceHeaders (no watchExtensions set).
    reloadFileData(uri: string, text: string): void {
        if (isInitialized() && this.fileIndex) {
            const result = parseFile(uri, text);
            this.fileIndex.updateFile(uri, result);
        }
    }

    async compile(uri: string, text: string, interactive: boolean): Promise<void> {
        if (!this.storedContext) {
            conlog("WeiDU D provider not initialized, cannot compile");
            return;
        }
        await weiduCompile(uri, this.storedContext.settings.weidu, interactive, text);
    }
}

export const weiduDProvider: LanguageProvider = new WeiduDProvider();
