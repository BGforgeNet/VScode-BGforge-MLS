/**
 * LanguageProvider interface - the contract for all language support.
 *
 * Each language implements this interface to provide features.
 * Features are optional - implement only what the language supports.
 */

import {
    CompletionItem,
    DocumentSymbol,
    Hover,
    InlayHint,
    Location,
    Position,
    Range,
    SignatureHelp,
    TextEdit,
    WorkspaceEdit,
} from "vscode-languageserver/node";

import { MLSsettings } from "./settings";

/**
 * Result from formatting a document.
 * Includes edits and optional warning message for validation failures.
 */
export interface FormatResult {
    edits: TextEdit[];
    /** Warning message to show to user (e.g., validation failure) */
    warning?: string;
}

/**
 * Context passed to providers during initialization.
 * Contains everything a provider needs to set up.
 */
export interface ProviderContext {
    /** Absolute path to workspace root */
    workspaceRoot: string;
    /** User settings */
    settings: MLSsettings;
}

/**
 * Result from parsing a file for user-defined symbols.
 */
export interface ParsedFileData {
    completion?: CompletionItem[];
    hover?: Map<string, Hover>;
    signature?: Map<string, SignatureHelp>;
    definition?: Map<string, Location>;
}

/**
 * The core interface for language support.
 *
 * Features fall into two categories:
 * 1. Document features (AST-based) - operate on current document text
 * 2. Data features (static/parsed) - lookup from pre-loaded or parsed data
 */
export interface LanguageProvider {
    /** Language identifier (matches VS Code languageId) */
    readonly id: string;

    /**
     * Initialize the provider (load parsers, static data, headers, etc.)
     * Called once at startup with context containing workspace and settings.
     */
    init(context: ProviderContext): Promise<void>;

    /**
     * Returns false if LSP features (hover, definition, rename) should be suppressed at this position.
     * Use for zones like comments where code intelligence doesn't apply.
     * Defaults to true (provide features) if not implemented.
     * Note: completion uses its own context system (filterCompletions) for finer granularity.
     */
    shouldProvideFeatures?(text: string, position: Position): boolean;

    // =========================================================================
    // Document features (AST-based, operate on current text)
    // =========================================================================

    /** Format the document. Returns edits and optional warning message. */
    format?(text: string, uri: string): FormatResult;

    /** Get document symbols (for outline view, Ctrl+Shift+O). */
    symbols?(text: string): DocumentSymbol[];

    /** Go to definition at position. For in-file definitions (e.g., state labels). */
    definition?(text: string, position: Position, uri: string): Location | null;

    /** Get hover info for a local symbol. Returns null to fall back to data hover. */
    hover?(text: string, symbol: string, uri: string, position: Position): Hover | null;

    /** Get completion items for locally defined symbols. */
    localCompletion?(text: string): CompletionItem[];

    /**
     * Filter completions based on cursor position context.
     * Called after all completions are gathered, before returning to client.
     * Only implement if the language has context-specific completions.
     */
    filterCompletions?(items: CompletionItem[], text: string, position: Position, uri: string, triggerCharacter?: string): CompletionItem[];

    /** Get signature help for a locally defined procedure. Returns null to fall back to headers. */
    localSignature?(text: string, symbol: string, paramIndex: number): SignatureHelp | null;

    /** Rename a local symbol. Returns null if symbol is not locally defined. */
    rename?(text: string, position: Position, newName: string, uri: string): WorkspaceEdit | null;

    /** Prepare for rename. Validates position and returns range/placeholder, or null if rename not allowed. */
    prepareRename?(text: string, position: Position): { range: { start: Position; end: Position }; placeholder: string } | null;

    /** Get inlay hints for the given range. */
    inlayHints?(text: string, uri: string, range: Range): InlayHint[];

    // =========================================================================
    // Data features (static + parsed from headers/files)
    // =========================================================================

    /** Get completions for the document. Combines static + headers + file-specific. */
    getCompletions?(uri: string): CompletionItem[];

    /** Get hover info for a symbol. */
    getHover?(uri: string, symbol: string): Hover | null;

    /** Get signature help for a symbol. */
    getSignature?(uri: string, symbol: string, paramIndex: number): SignatureHelp | null;

    /** Get definition location for a symbol (data-driven, from headers). */
    getSymbolDefinition?(symbol: string): Location | null;

    // =========================================================================
    // File parsing (for user-defined functions, macros, etc.)
    // =========================================================================

    /** Parse a file to extract user-defined symbols. Called on open/change. */
    parseFile?(uri: string, text: string): ParsedFileData | null;

    /** Reload data for a file (update internal caches). */
    reloadFileData?(uri: string, text: string): void;

    // =========================================================================
    // Compilation
    // =========================================================================

    /**
     * Compile/validate the document. Sends diagnostics via the connection.
     * @param uri Document URI
     * @param text Document text
     * @param interactive True if triggered by user command (shows messages), false for auto-validation
     */
    compile?(uri: string, text: string, interactive: boolean): Promise<void>;

    // =========================================================================
    // File watching (for external changes to workspace files)
    // =========================================================================

    /**
     * File extensions this provider watches for changes (e.g., [".tph", ".h"]).
     * Used to detect external file changes and update indices.
     */
    watchExtensions?: string[];

    /**
     * Called when a watched file is deleted from the workspace.
     * Provider should clean up any cached data for this file.
     */
    onWatchedFileDeleted?(uri: string): void;

    /**
     * Called when a document is closed.
     * Provider should clean up per-document cached data (self maps).
     */
    onDocumentClosed?(uri: string): void;
}

