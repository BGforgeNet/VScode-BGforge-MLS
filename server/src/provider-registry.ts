/**
 * Provider Registry - manages all language providers and routes requests.
 *
 * This is the central hub for language features. It:
 * 1. Registers providers for each language
 * 2. Initializes them at startup
 * 3. Routes feature requests to the appropriate provider
 */

import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";
import {
    CompletionItem,
    DocumentSymbol,
    FileChangeType,
    Hover,
    Location,
    Position,
    Range,
    InlayHint,
    SignatureHelp,
    WatchKind,
    WorkspaceEdit,
} from "vscode-languageserver/node";
import { FormatResult, LanguageProvider, ProviderContext } from "./language-provider";
import { conlog } from "./common";

class ProviderRegistry {
    private providers: Map<string, LanguageProvider> = new Map();
    private context: ProviderContext | undefined;
    /** Maps alias language IDs to their parent provider ID */
    private aliases: Map<string, string> = new Map();
    /** Maps file extensions to providers for file watching (e.g., ".tph" -> weidu-tp2 provider) */
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
    }

    /**
     * Build the extension -> provider map from all providers' watchExtensions.
     */
    private buildExtensionMap(): void {
        for (const provider of this.providers.values()) {
            if (!provider.watchExtensions) continue;
            for (const ext of provider.watchExtensions) {
                this.extensionToProvider.set(ext.toLowerCase(), provider);
            }
        }
        conlog(`Built extension map with ${this.extensionToProvider.size} extensions`);
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

    // =========================================================================
    // Feature routing - delegates to appropriate provider
    // =========================================================================

    format(langId: string, text: string, uri: string): FormatResult {
        const provider = this.get(langId);
        if (provider?.format) {
            return provider.format(text, uri);
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

    definition(langId: string, text: string, position: Position, uri: string): Location | null {
        const provider = this.get(langId);
        if (provider?.definition) {
            return provider.definition(text, position, uri);
        }
        return null;
    }

    inlayHints(langId: string, text: string, uri: string, range: Range): InlayHint[] {
        const provider = this.get(langId);
        if (provider?.inlayHints) {
            return provider.inlayHints(text, uri, range);
        }
        return [];
    }

    rename(langId: string, text: string, position: Position, newName: string, uri: string): WorkspaceEdit | null {
        const provider = this.get(langId);
        if (provider?.rename) {
            return provider.rename(text, position, newName, uri);
        }
        return null;
    }

    // =========================================================================
    // Data feature routing - lookup from loaded/parsed data
    // =========================================================================

    /**
     * Get completions, merging local + headers.
     * Local symbols take precedence (deduplicated by label).
     */
    completion(langId: string, text: string, uri: string): CompletionItem[] {
        const provider = this.get(langId);
        if (!provider) {
            return [];
        }

        // Get local completions (tree-sitter based for current file)
        const localItems = provider.localCompletion ? provider.localCompletion(text) : [];

        // Get header/static completions
        const headerItems = provider.getCompletions ? provider.getCompletions(uri) : [];

        // Merge with local taking precedence
        const localLabels = new Set(localItems.map(item => item.label));
        const filtered = headerItems.filter(item => !localLabels.has(item.label));

        return [...localItems, ...filtered];
    }

    /** AST-based hover for local symbols. */
    localHover(langId: string, text: string, symbol: string, uri: string): Hover | null {
        const provider = this.get(langId);
        if (provider?.hover) {
            return provider.hover(text, symbol, uri);
        }
        return null;
    }

    /** Data-driven hover from headers/static data. */
    hover(langId: string, uri: string, symbol: string): Hover | null {
        const provider = this.get(langId);
        if (provider?.getHover) {
            return provider.getHover(uri, symbol);
        }
        return null;
    }

    /**
     * Get signature help, trying local first, then headers.
     * Local symbols take precedence.
     */
    signature(langId: string, text: string, uri: string, symbol: string, paramIndex: number): SignatureHelp | null {
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
            return provider.getSignature(uri, symbol, paramIndex);
        }

        return null;
    }

    symbolDefinition(langId: string, symbol: string): Location | null {
        const provider = this.get(langId);
        if (provider?.getSymbolDefinition) {
            return provider.getSymbolDefinition(symbol);
        }
        return null;
    }

    reloadFileData(langId: string, uri: string, text: string): void {
        const provider = this.get(langId);
        if (provider?.reloadFileData) {
            provider.reloadFileData(uri, text);
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
        const provider = this.get(langId);
        if (provider?.compile) {
            await provider.compile(uri, text, interactive);
            return true;
        }
        return false;
    }

    // =========================================================================
    // File watching (for external changes to workspace files)
    // =========================================================================

    /**
     * Get watch patterns for LSP registration.
     * Collects all watchExtensions from providers and converts to glob patterns.
     */
    getWatchPatterns(): { globPattern: string; kind: number }[] {
        const patterns: { globPattern: string; kind: number }[] = [];
        const watchAll = WatchKind.Create | WatchKind.Change | WatchKind.Delete;

        for (const provider of this.providers.values()) {
            if (!provider.watchExtensions) continue;
            for (const ext of provider.watchExtensions) {
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
        const filePath = fileURLToPath(uri);
        const ext = extname(filePath).toLowerCase();
        const provider = this.extensionToProvider.get(ext);

        if (!provider) {
            return;
        }

        if (changeType === FileChangeType.Deleted) {
            if (provider.onWatchedFileDeleted) {
                provider.onWatchedFileDeleted(uri);
                conlog(`File deleted, cleared from index: ${filePath}`);
            }
        } else {
            // Created or Changed - reload the file data
            try {
                const text = readFileSync(filePath, "utf-8");
                if (provider.reloadFileData) {
                    provider.reloadFileData(uri, text);
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
        const provider = this.get(langId);
        if (provider?.onDocumentClosed) {
            provider.onDocumentClosed(uri);
        }
    }
}

// Singleton instance
export const registry = new ProviderRegistry();
