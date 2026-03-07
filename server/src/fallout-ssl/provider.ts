/**
 * Fallout SSL language provider.
 * Implements all Fallout SSL file features in one place.
 *
 * Uses unified Symbols storage for static completion and hover data.
 * Header-based symbols (procedures, macros from .h files) are handled by header-parser.
 * Local symbols (current file) are built with language-specific formatters
 * in local-symbols.ts, following the same pattern as TP2.
 *
 * Maintains an include graph for workspace-wide rename support.
 */

import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type CompletionItem, type DocumentSymbol, type FoldingRange, type Location, type Position, type SignatureHelp, type SymbolInformation, type WorkspaceEdit } from "vscode-languageserver/node";
import type { IndexedSymbol } from "../core/symbol";
import { conlog, findFiles, getLinePrefix, pathToUri } from "../common";
import { EXT_FALLOUT_SSL_ALL, EXT_FALLOUT_SSL_HEADERS, LANG_FALLOUT_SSL } from "../core/languages";
import { IncludeGraph } from "../core/include-graph";
import { resolveIncludePath } from "../core/include-resolver";
import { isHeaderFile } from "../core/location-utils";
import { Symbols } from "../core/symbol-index";
import { loadStaticSymbols } from "../core/static-loader";
import { compile as falloutCompile } from "./compiler";
import { type FormatResult, type LanguageProvider, type ProviderContext } from "../language-provider";
import { formatWithValidation, resolveSymbolWithLocal } from "../shared/provider-helpers";
import { getJsdocCompletions } from "../shared/jsdoc-completions";
import { FALLOUT_JSDOC_TYPES } from "../shared/fallout-types";
import { stripCommentsFalloutSsl } from "../shared/format-utils";
import { getFormatOptions } from "../shared/format-options";
import * as signature from "../shared/signature";
import { formatDocument as formatAst } from "./format-core";
import { initParser, isInitialized, parseWithCache } from "./parser";
import { createFoldingRangesProvider } from "../shared/folding-ranges";
import { getDocumentSymbols } from "./symbol";
import { getLocalDefinition } from "./definition";
import { renameSymbol, prepareRenameSymbol, renameSymbolWorkspace, prepareRenameSymbolWorkspace } from "./rename";
import { getLocalSignature } from "./signature";
import { parseHeaderToSymbols } from "./header-parser";
import { getLocalSymbols, lookupLocalSymbol, clearLocalSymbolsCache } from "./local-symbols";
import { getSslCompletionContext, SslCompletionContext, isSslDeclarationSite } from "./completion-context";
import { extractIncludes } from "./include-scanner";
import { WorkspaceSymbolIndex } from "../shared/workspace-symbols";
import { SyntaxType } from "./tree-sitter.d";

/** SSL block-level node types for code folding. */
const SSL_FOLDABLE_TYPES = new Set([
    SyntaxType.Procedure,
    SyntaxType.IfStmt,
    SyntaxType.WhileStmt,
    SyntaxType.ForStmt,
    SyntaxType.ForeachStmt,
    SyntaxType.SwitchStmt,
    SyntaxType.Block,
]);

const sslFoldingRanges = createFoldingRangesProvider(isInitialized, parseWithCache, SSL_FOLDABLE_TYPES);

/** File extensions to scan for the include graph, derived from language constants. */
const INCLUDE_GRAPH_EXTENSIONS = EXT_FALLOUT_SSL_ALL.map(ext => ext.slice(1));

class FalloutSslProvider implements LanguageProvider {
    readonly id = LANG_FALLOUT_SSL;
    // Only watch header files for external change events. Non-header .ssl files
    // get workspace symbol updates via onDidChangeContent (open documents) and
    // buildIncludeGraph (startup scan). Adding .ssl here would cause double I/O
    // at startup since buildIncludeGraph already reads all .ssl files.
    readonly watchExtensions = [...EXT_FALLOUT_SSL_HEADERS];

    private symbolStore: Symbols | undefined;
    private staticSignatures: signature.SigMap | undefined;
    private storedContext: ProviderContext | undefined;
    private includeGraph: IncludeGraph | undefined;
    private wsSymbolIndex: WorkspaceSymbolIndex | undefined;

    async init(context: ProviderContext): Promise<void> {
        this.storedContext = context;

        await initParser();

        this.symbolStore = new Symbols();
        const staticSymbols = loadStaticSymbols(LANG_FALLOUT_SSL);
        this.symbolStore.loadStatic(staticSymbols);

        this.wsSymbolIndex = new WorkspaceSymbolIndex();

        this.staticSignatures = signature.loadStatic(LANG_FALLOUT_SSL);

        // Build include graph from workspace files (async to avoid blocking the event loop)
        this.includeGraph = new IncludeGraph();
        if (context.workspaceRoot) {
            await this.buildIncludeGraph(context.workspaceRoot);
        }

        conlog(`Fallout SSL provider initialized with ${staticSymbols.length} static symbols`);
    }

    /**
     * Scan workspace for all relevant files, populate the include graph and
     * workspace symbol index.
     *
     * Uses async I/O to avoid blocking the event loop at startup.
     * Called once at init time.
     *
     * This method reads ALL .ssl and .h files. watchExtensions is intentionally
     * set to .h only (see comment there) so that scanWorkspaceHeaders does NOT
     * re-read .ssl files. Without this separation, every .ssl file would be read
     * twice at startup: once here (async) and once in scanWorkspaceHeaders (sync).
     * Open .ssl documents still get workspace symbol updates at runtime via
     * onDidChangeContent -> reloadFileData.
     */
    private async buildIncludeGraph(workspaceRoot: string): Promise<void> {
        if (!this.includeGraph) return;

        const filePaths: { absolutePath: string; uri: string }[] = [];
        for (const ext of INCLUDE_GRAPH_EXTENSIONS) {
            const files = findFiles(workspaceRoot, ext);
            for (const relativePath of files) {
                const absolutePath = join(workspaceRoot, relativePath);
                filePaths.push({ absolutePath, uri: pathToUri(absolutePath) });
            }
        }

        const results = await Promise.allSettled(
            filePaths.map(async ({ absolutePath, uri }) => {
                const text = await readFile(absolutePath, "utf-8");
                this.updateIncludeGraphForFile(uri, text);

                // Populate workspace symbols from the same text we just read,
                // avoiding a second I/O pass in scanWorkspaceHeaders.
                if (this.wsSymbolIndex && isInitialized()) {
                    this.wsSymbolIndex.updateFile(uri, getDocumentSymbols(text));
                }
            }),
        );

        let fileCount = 0;
        for (const result of results) {
            if (result.status === "fulfilled") {
                fileCount++;
            }
        }
        // Log failures separately — results and filePaths arrays are parallel
        const failures = results
            .map((r, i) => r.status === "rejected" ? filePaths[i] : null)
            .filter((f): f is { absolutePath: string; uri: string } => f !== null);
        for (const f of failures) {
            conlog(`Include graph: failed to read ${f.absolutePath}`);
        }

        conlog(`Include graph: indexed ${fileCount} files`);
    }

    /**
     * Parse a file and update its include edges in the graph.
     */
    private updateIncludeGraphForFile(uri: string, text: string): void {
        if (!this.includeGraph || !isInitialized()) return;

        // parseWithCache is keyed by text content hash, not by URI, so passing
        // fresh text here always produces an up-to-date tree — no stale cache risk.
        const tree = parseWithCache(text);
        if (!tree) {
            this.includeGraph.updateFile(uri, []);
            return;
        }

        const rawIncludes = extractIncludes(tree.rootNode);
        const filePath = fileURLToPath(uri);
        const searchPaths = this.getSearchPaths();

        const resolvedIncludes = rawIncludes
            .map(raw => resolveIncludePath(raw, {
                includingFilePath: filePath,
                workspaceRoot: this.storedContext?.workspaceRoot,
                searchPaths,
            }))
            .filter((resolved): resolved is string => resolved !== null);

        this.includeGraph.updateFile(uri, resolvedIncludes);
    }

    /** Get search paths for include resolution (headersDirectory if configured). */
    private getSearchPaths(): readonly string[] {
        // settings may be partially initialized in tests (e.g. `{} as MLSsettings`)
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        const headersDir = this.storedContext?.settings?.falloutSSL?.headersDirectory;
        return headersDir ? [headersDir] : [];
    }

    /**
     * Read file text, preferring open document buffers over disk.
     * Returns null if the file cannot be read.
     */
    private readFileText(uri: string): string | null {
        // Try open document buffer first
        const bufferText = this.storedContext?.getDocumentText?.(uri);
        if (bufferText !== undefined) {
            return bufferText;
        }

        // Fall back to disk.
        // NOTE: readFileSync is used because the LSP rename handler is synchronous.
        // For large workspaces with many transitive dependants this could block the
        // event loop. Acceptable for now since renames are infrequent and user-initiated.
        try {
            return readFileSync(fileURLToPath(uri), "utf-8");
        } catch (err) {
            conlog(`readFileText: failed to read ${uri}: ${err}`);
            return null;
        }
    }

    resolveSymbol(name: string, text: string, uri: string): IndexedSymbol | undefined {
        return resolveSymbolWithLocal(name, text, uri, this.symbolStore, lookupLocalSymbol);
    }

    format(text: string, uri: string): FormatResult {
        return formatWithValidation({
            text,
            uri,
            languageName: "SSL",
            isInitialized,
            parse: parseWithCache,
            formatAst: (rootNode, options) => formatAst(rootNode, options),
            getFormatOptions,
            stripComments: stripCommentsFalloutSsl,
        });
    }

    symbols(text: string): DocumentSymbol[] {
        if (!isInitialized()) {
            return [];
        }
        return getDocumentSymbols(text);
    }

    foldingRanges(text: string): FoldingRange[] {
        return sslFoldingRanges(text);
    }

    definition(text: string, position: Position, uri: string): Location | null {
        if (!isInitialized()) {
            return null;
        }
        return getLocalDefinition(text, uri, position);
    }

    filterCompletions(items: CompletionItem[], text: string, position: Position, uri: string, triggerCharacter?: string): CompletionItem[] {
        const context = getSslCompletionContext(text, position);

        if (context === SslCompletionContext.Comment) {
            return [];
        }
        if (context === SslCompletionContext.Jsdoc) {
            return getJsdocCompletions(FALLOUT_JSDOC_TYPES, getLinePrefix(text, position));
        }

        if (triggerCharacter === "@") {
            return [];
        }

        // At declaration sites (e.g. procedure <name>, variable <name>, #define <name>),
        // the user is naming a new symbol — completions are not useful.
        if (isSslDeclarationSite(text, position)) {
            return [];
        }

        // Merge local symbols into completions (local takes precedence)
        const localSymbols = getLocalSymbols(text, uri);
        const localLabels = new Set(localSymbols.map(s => s.name));
        const filtered = items.filter(item => !localLabels.has(item.label as string));
        return [...localSymbols.map(s => s.completion), ...filtered];
    }

    shouldProvideFeatures(text: string, position: Position): boolean {
        const context = getSslCompletionContext(text, position);
        return context === SslCompletionContext.Code;
    }

    localSignature(text: string, symbol: string, paramIndex: number): SignatureHelp | null {
        if (!isInitialized()) {
            return null;
        }
        return getLocalSignature(text, symbol, paramIndex);
    }

    prepareRename(text: string, position: Position): { range: { start: Position; end: Position }; placeholder: string } | null {
        if (!isInitialized()) {
            return null;
        }

        // Try workspace-aware prepare first (allows renaming header-defined symbols)
        if (this.includeGraph && this.symbolStore) {
            const wsResult = prepareRenameSymbolWorkspace(text, position, this.symbolStore, this.storedContext?.workspaceRoot);
            if (wsResult) {
                return wsResult;
            }
        }

        // Fall back to single-file prepare (local variables, params)
        return prepareRenameSymbol(text, position);
    }

    rename(text: string, position: Position, newName: string, uri: string): WorkspaceEdit | null {
        if (!isInitialized()) {
            return null;
        }

        // Try workspace-wide rename first (for symbols defined in headers)
        if (this.includeGraph && this.symbolStore) {
            const wsResult = renameSymbolWorkspace(
                text, position, newName, uri,
                this.includeGraph, this.symbolStore,
                (fileUri) => this.readFileText(fileUri),
                this.storedContext?.workspaceRoot,
            );
            if (wsResult) {
                return wsResult;
            }
        }

        // Fall back to single-file rename (local variables, params)
        return renameSymbol(text, position, newName, uri);
    }

    getCompletions(uri: string): CompletionItem[] {
        return this.symbolStore ? this.symbolStore.query({ excludeUri: uri }).map((s: IndexedSymbol) => s.completion) : [];
    }

    getSignature(_uri: string, symbolName: string, paramIndex: number): SignatureHelp | null {
        if (this.staticSignatures) {
            const sig = this.staticSignatures.get(symbolName);
            if (sig) {
                return signature.getResponse(sig, paramIndex);
            }
        }
        const symbol = this.symbolStore?.lookup(symbolName);
        if (symbol?.signature) {
            return signature.getResponse(symbol.signature, paramIndex);
        }
        return null;
    }

    getSymbolDefinition(symbolName: string): Location | null {
        const symbol = this.symbolStore?.lookup(symbolName);
        return symbol?.location ?? null;
    }

    reloadFileData(uri: string, text: string): void {
        if (isHeaderFile(uri) && this.symbolStore) {
            const parsedSymbols = parseHeaderToSymbols(uri, text, this.storedContext?.workspaceRoot);
            this.symbolStore.updateFile(uri, parsedSymbols);
        }

        // Update include graph for any file type
        this.updateIncludeGraphForFile(uri, text);

        // Update workspace symbol index for all files
        if (this.wsSymbolIndex && isInitialized()) {
            this.wsSymbolIndex.updateFile(uri, getDocumentSymbols(text));
        }
    }

    onWatchedFileDeleted(uri: string): void {
        this.symbolStore?.clearFile(uri);
        this.includeGraph?.removeFile(uri);
        this.wsSymbolIndex?.removeFile(uri);
    }

    workspaceSymbols(query: string): SymbolInformation[] {
        return this.wsSymbolIndex?.search(query) ?? [];
    }

    onDocumentClosed(uri: string): void {
        clearLocalSymbolsCache(uri);
    }

    async compile(uri: string, text: string, interactive: boolean): Promise<void> {
        if (!this.storedContext) {
            conlog("Fallout SSL provider not initialized, cannot compile");
            return;
        }
        await falloutCompile(uri, this.storedContext.settings.falloutSSL, interactive, text);
    }
}

export const falloutSslProvider: LanguageProvider = new FalloutSslProvider();
