/**
 * Provider Registry - manages all language providers and routes requests.
 *
 * This is the central hub for language features. It:
 * 1. Registers providers for each language
 * 2. Initializes them at startup
 * 3. Routes feature requests to the appropriate provider
 *
 * URI normalization: All public methods that accept URIs normalize them
 * before passing to providers. This ensures consistent encoding regardless
 * of whether the URI came from VSCode (may percent-encode e.g. ! as %21)
 * or from pathToFileURL (leaves ! unencoded). See core/normalized-uri.ts.
 */

import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    CompletionItem,
    DocumentSymbol,
    FileChangeType,
    FoldingRange,
    Hover,
    Location,
    Position,
    Range,
    InlayHint,
    SemanticTokens,
    SignatureHelp,
    SymbolInformation,
    WatchKind,
    WorkspaceEdit,
} from "vscode-languageserver/node";
import { FormatResult, HoverResult, LanguageProvider, ProviderContext } from "./language-provider";
import { conlog, findFiles, pathToUri } from "./common";
import { validLocationOrNull } from "./core/location-utils";
import { normalizeUri } from "./core/normalized-uri";
import { decodeWorkspaceSymbolQuery } from "../../shared/protocol";
import { encodeSemanticTokens } from "./shared/semantic-tokens";

class ProviderRegistry {
    private providers: Map<string, LanguageProvider> = new Map();
    private context: ProviderContext | undefined;
    /** Maps alias language IDs to their parent provider ID */
    private aliases: Map<string, string> = new Map();
    /** Maps indexed file extensions to providers (e.g., ".tph" -> weidu-tp2 provider) */
    private extensionToProvider: Map<string, LanguageProvider> = new Map();

    /**
     * Register a language provider.
     */
    register(provider: LanguageProvider): void {
        this.providers.set(provider.id, provider);
        conlog(`Registered provider: ${provider.id}`);
    }

    /**
     * Register an alias language ID that shares data with an existing provider.
     * The alias language will use the parent provider for data features.
     */
    registerAlias(aliasLangId: string, parentLangId: string): void {
        this.aliases.set(aliasLangId, parentLangId);
        conlog(`Registered alias: ${aliasLangId} -> ${parentLangId}`);
    }

    /**
     * Resolve a language ID, following aliases if present.
     */
    private resolveLangId(langId: string): string {
        return this.aliases.get(langId) ?? langId;
    }

    /**
     * Initialize all registered providers with the given context.
     */
    async init(context: ProviderContext): Promise<void> {
        this.context = context;
        // Initialize sequentially to avoid race conditions in web-tree-sitter.
        //
        // web-tree-sitter uses a shared TRANSFER_BUFFER for JS/WASM communication
        // (see https://github.com/tree-sitter/tree-sitter/pull/570). When multiple
        // Language.load() calls run concurrently, they race on this buffer and
        // corrupt parser state - parsing returns ERROR nodes for valid input.
        //
        // This is undocumented; the README only shows single-language examples:
        // https://github.com/tree-sitter/tree-sitter/blob/master/lib/binding_web/README.md
        for (const provider of this.providers.values()) {
            try {
                await provider.init(context);
            } catch (error) {
                conlog(`Failed to initialize provider ${provider.id}: ${error}`);
            }
        }
        conlog(`Initialized ${this.providers.size} providers`);

        // Build extension -> provider map for file watching
        this.buildExtensionMap();

        // Scan workspace for indexed files and populate provider caches
        await this.scanWorkspaceFiles(context.workspaceRoot);
    }

    /**
     * Build the extension -> provider map from all providers' indexExtensions.
     */
    private buildExtensionMap(): void {
        for (const provider of this.providers.values()) {
            if (!provider.indexExtensions) continue;
            for (const ext of provider.indexExtensions) {
                this.extensionToProvider.set(ext.toLowerCase(), provider);
            }
        }
        conlog(`Built extension map with ${this.extensionToProvider.size} extensions`);
    }

    /**
     * Scan workspace for indexed files and reload them through their providers.
     * Called after providers are initialized to populate indices at startup.
     *
     * Uses each provider's indexExtensions to find files and reloadFileData to index them.
     * This keeps startup scan, file watching, and delete cleanup on the same contract.
     */
    async scanWorkspaceFiles(workspaceRoot: string | undefined): Promise<void> {
        if (!workspaceRoot) {
            return;
        }

        for (const provider of this.providers.values()) {
            if (!provider.indexExtensions || !provider.reloadFileData) {
                continue;
            }

            for (const ext of provider.indexExtensions) {
                // Remove leading dot for findFiles (e.g., ".tph" -> "tph")
                const extWithoutDot = ext.startsWith(".") ? ext.slice(1) : ext;
                const files = findFiles(workspaceRoot, extWithoutDot);

                const results = await Promise.allSettled(
                    files.map(async (relativePath) => {
                        const absolutePath = join(workspaceRoot, relativePath);
                        const uri = pathToUri(absolutePath);
                        const text = await readFile(absolutePath, "utf-8");
                        this.reloadFileData(provider.id, uri, text);
                    }),
                );

                const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
                if (failures.length > 0) {
                    conlog(`Startup scan for ${provider.id} (${ext}) had ${failures.length} read failures`);
                }
                if (files.length > 0) {
                    conlog(`Scanned ${files.length} ${ext} files for ${provider.id}`);
                }
            }
        }
    }

    /**
     * Update settings on the shared context so all providers see the change
     * without requiring a reload. Called from onDidChangeConfiguration.
     */
    updateSettings(settings: ProviderContext["settings"]): void {
        if (this.context) {
            this.context.settings = settings;
        }
    }

    /**
     * Get the initialization context. Throws if not initialized.
     */
    getContext(): ProviderContext {
        if (!this.context) {
            throw new Error("ProviderRegistry not initialized");
        }
        return this.context;
    }

    /**
     * Get a provider by language ID (resolves aliases).
     */
    get(langId: string): LanguageProvider | undefined {
        return this.providers.get(this.resolveLangId(langId));
    }

    /**
     * Check if a provider exists for the language (resolves aliases).
     */
    has(langId: string): boolean {
        return this.providers.has(this.resolveLangId(langId)) || this.aliases.has(langId);
    }

    /**
     * Check if LSP features should be provided at this position.
     * Returns false when the cursor is in a zone where features should be suppressed
     * (e.g., inside comments). Defaults to true if not implemented by the provider.
     */
    shouldProvideFeatures(langId: string, text: string, position: Position): boolean {
        const provider = this.get(langId);
        if (provider?.shouldProvideFeatures) {
            return provider.shouldProvideFeatures(text, position);
        }
        return true;
    }

    // =========================================================================
    // Feature routing - delegates to appropriate provider
    // =========================================================================

    format(langId: string, text: string, uri: string): FormatResult {
        const normUri = normalizeUri(uri);
        const provider = this.get(langId);
        if (provider?.format) {
            return provider.format(text, normUri);
        }
        return { edits: [] };
    }

    symbols(langId: string, text: string): DocumentSymbol[] {
        const provider = this.get(langId);
        if (provider?.symbols) {
            return provider.symbols(text);
        }
        return [];
    }

    /**
     * Search workspace symbols across all providers.
     * Aggregates results from every provider that implements workspaceSymbols.
     */
    workspaceSymbols(query: string): SymbolInformation[] {
        const decoded = decodeWorkspaceSymbolQuery(query);
        if (decoded.languageId) {
            const provider = this.get(decoded.languageId);
            return provider?.workspaceSymbols?.(decoded.query) ?? [];
        }

        const results: SymbolInformation[] = [];
        for (const provider of this.providers.values()) {
            if (provider.workspaceSymbols) {
                results.push(...provider.workspaceSymbols(decoded.query));
            }
        }
        return results;
    }

    foldingRanges(langId: string, text: string): FoldingRange[] {
        const provider = this.get(langId);
        if (provider?.foldingRanges) {
            return provider.foldingRanges(text);
        }
        return [];
    }

    definition(langId: string, text: string, position: Position, uri: string): Location | null {
        const normUri = normalizeUri(uri);
        const provider = this.get(langId);
        if (provider?.definition) {
            return provider.definition(text, position, normUri);
        }
        return null;
    }

    references(langId: string, text: string, position: Position, uri: string, includeDeclaration: boolean): Location[] {
        const normUri = normalizeUri(uri);
        const provider = this.get(langId);
        if (provider?.references) {
            return provider.references(text, position, normUri, includeDeclaration);
        }
        return [];
    }

    inlayHints(langId: string, text: string, uri: string, range: Range): InlayHint[] {
        const normUri = normalizeUri(uri);
        const provider = this.get(langId);
        if (provider?.inlayHints) {
            return provider.inlayHints(text, normUri, range);
        }
        return [];
    }

    semanticTokens(langId: string, text: string, uri: string): SemanticTokens {
        const normUri = normalizeUri(uri);
        const provider = this.get(langId);
        return encodeSemanticTokens(provider?.semanticTokens?.(text, normUri) ?? []);
    }

    prepareRename(langId: string, text: string, position: Position): { range: { start: Position; end: Position }; placeholder: string } | null {
        const provider = this.get(langId);
        if (provider?.prepareRename) {
            return provider.prepareRename(text, position);
        }
        return null;
    }

    rename(langId: string, text: string, position: Position, newName: string, uri: string): WorkspaceEdit | null {
        const normUri = normalizeUri(uri);
        const provider = this.get(langId);
        if (provider?.rename) {
            return provider.rename(text, position, newName, normUri);
        }
        return null;
    }

    // =========================================================================
    // Data feature routing - lookup from loaded/parsed data
    // =========================================================================

    /**
     * Get completions from headers/static data, then apply context-based filtering.
     * Local symbol merging happens inside each provider's filterCompletions().
     */
    completion(langId: string, text: string, uri: string, position?: Position, triggerCharacter?: string): CompletionItem[] {
        const normUri = normalizeUri(uri);
        const provider = this.get(langId);
        if (!provider) {
            return [];
        }

        // Get header/static completions
        const headerItems = provider.getCompletions ? provider.getCompletions(normUri) : [];

        let result = [...headerItems];

        // Apply context-based filtering if provider supports it
        if (provider.filterCompletions && position) {
            result = provider.filterCompletions(result, text, position, normUri, triggerCharacter);
        }

        return result;
    }

    /** AST-based hover for local symbols. Returns HoverResult indicating whether provider handled it. */
    localHover(langId: string, text: string, symbol: string, uri: string, position: Position): HoverResult {
        const normUri = normalizeUri(uri);
        const provider = this.get(langId);
        if (provider?.hover) {
            return provider.hover(text, symbol, normUri, position);
        }
        return HoverResult.notHandled();
    }

    /**
     * Get hover info using unified symbol resolution.
     *
     * Uses provider.resolveSymbol() which handles ALL merge logic:
     * - Local symbols (fresh buffer) checked first
     * - Indexed symbols (headers + static) as fallback, excluding current file
     */
    hover(langId: string, uri: string, symbol: string, text?: string): Hover | null {
        const normUri = normalizeUri(uri);
        const provider = this.get(langId);
        if (!provider) {
            return null;
        }

        if (text && provider.resolveSymbol) {
            const resolved = provider.resolveSymbol(symbol, text, normUri);
            if (resolved?.hover) {
                return resolved.hover;
            }
            return null;
        }

        return null;
    }

    /**
     * Get signature help, trying local first, then headers.
     * Local symbols take precedence.
     */
    signature(langId: string, text: string, uri: string, symbol: string, paramIndex: number): SignatureHelp | null {
        const normUri = normalizeUri(uri);
        const provider = this.get(langId);
        if (!provider) {
            return null;
        }

        // Try local first (tree-sitter based for current file)
        if (provider.localSignature) {
            const local = provider.localSignature(text, symbol, paramIndex);
            if (local) {
                return local;
            }
        }

        // Fall back to headers/static
        if (provider.getSignature) {
            return provider.getSignature(normUri, symbol, paramIndex);
        }

        return null;
    }

    symbolDefinition(langId: string, symbol: string): Location | null {
        const provider = this.get(langId);
        if (provider?.getSymbolDefinition) {
            // Validate location to prevent returning empty URIs to VSCode
            return validLocationOrNull(provider.getSymbolDefinition(symbol));
        }
        return null;
    }

    reloadFileData(langId: string, uri: string, text: string): void {
        const normUri = normalizeUri(uri);
        const provider = this.get(langId);
        if (provider?.reloadFileData) {
            provider.reloadFileData(normUri, text);
        }
    }

    // =========================================================================
    // Compilation
    // =========================================================================

    /**
     * Compile a file using the appropriate provider.
     * @returns true if a provider handled the compilation, false otherwise
     */
    async compile(langId: string, uri: string, text: string, interactive: boolean): Promise<boolean> {
        const normUri = normalizeUri(uri);
        const provider = this.get(langId);
        if (provider?.compile) {
            await provider.compile(normUri, text, interactive);
            return true;
        }
        return false;
    }

    // =========================================================================
    // File watching (for external changes to workspace files)
    // =========================================================================

    /**
     * Get watch patterns for LSP registration.
     * Collects all indexExtensions from providers and converts to glob patterns.
     */
    getWatchPatterns(): { globPattern: string; kind: number }[] {
        const patterns: { globPattern: string; kind: number }[] = [];
        const watchAll = WatchKind.Create | WatchKind.Change | WatchKind.Delete;

        for (const provider of this.providers.values()) {
            if (!provider.indexExtensions) continue;
            for (const ext of provider.indexExtensions) {
                patterns.push({
                    globPattern: `**/*${ext}`,
                    kind: watchAll,
                });
            }
        }
        return patterns;
    }

    /**
     * Handle a file change event from the workspace.
     * Routes to the appropriate provider based on file extension.
     */
    handleWatchedFileChange(uri: string, changeType: FileChangeType): void {
        const normUri = normalizeUri(uri);
        const filePath = fileURLToPath(normUri);
        const ext = extname(filePath).toLowerCase();
        const provider = this.extensionToProvider.get(ext);

        if (!provider) {
            return;
        }

        if (changeType === FileChangeType.Deleted) {
            if (provider.onWatchedFileDeleted) {
                provider.onWatchedFileDeleted(normUri);
                conlog(`File deleted, cleared from index: ${filePath}`);
            }
        } else {
            // Created or Changed - reload the file data
            try {
                const text = readFileSync(filePath, "utf-8");
                if (provider.reloadFileData) {
                    provider.reloadFileData(normUri, text);
                    conlog(`File ${changeType === FileChangeType.Created ? "created" : "changed"}, reloaded: ${filePath}`);
                }
            } catch (error) {
                conlog(`Failed to read file ${filePath}: ${error}`);
            }
        }
    }

    /**
     * Handle document close event.
     * Clears per-document cached data (self maps) to avoid memory leaks.
     */
    handleDocumentClosed(langId: string, uri: string): void {
        const normUri = normalizeUri(uri);
        const provider = this.get(langId);
        if (provider?.onDocumentClosed) {
            provider.onDocumentClosed(normUri);
        }
    }
}

// Singleton instance
export const registry = new ProviderRegistry();
