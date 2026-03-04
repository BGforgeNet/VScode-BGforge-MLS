/**
 * LanguageProvider interface - the contract for all language support.
 *
 * Each language implements this interface to provide features.
 * Features are optional - implement only what the language supports.
 */

import {
    CompletionItem,
    DocumentSymbol,
    FoldingRange,
    Hover,
    InlayHint,
    Location,
    Position,
    Range,
    SignatureHelp,
    TextEdit,
    WorkspaceEdit,
} from "vscode-languageserver/node";

import type { IndexedSymbol } from "./core/symbol";
import { MLSsettings } from "./settings";

/**
 * Result from a provider's hover method.
 * Discriminated union that replaces the ambiguous Hover | null | undefined return:
 * - handled=true, hover=Hover: provider found a result
 * - handled=true, hover=null: provider handled it but nothing to show (block fallthrough)
 * - handled=false: provider didn't handle it, fall through to data-driven hover
 */
export type HoverResult =
    | { readonly handled: true; readonly hover: Hover | null }
    | { readonly handled: false };

/** Factory helpers for creating HoverResult values. */
export const HoverResult = {
    found: (hover: Hover): HoverResult => ({ handled: true, hover }),
    empty: (): HoverResult => ({ handled: true, hover: null }),
    notHandled: (): HoverResult => ({ handled: false }),
} as const;

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
    /** Absolute path to workspace root, undefined if no workspace folders exist */
    workspaceRoot: string | undefined;
    /** User settings */
    settings: MLSsettings;
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

    /** Get folding ranges for code folding (collapse/expand blocks). */
    foldingRanges?(text: string): FoldingRange[];

    /** Go to definition at position. For in-file definitions (e.g., state labels). */
    definition?(text: string, position: Position, uri: string): Location | null;

    /** Get hover info for a local symbol. Uses HoverResult to explicitly signal handled/not-handled. */
    hover?(text: string, symbol: string, uri: string, position: Position): HoverResult;

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

    /**
     * Resolve a single symbol by name.
     *
     * This is the UNIFIED entry point for symbol lookup. All features
     * (hover, definition, signature) should use this method.
     *
     * The provider handles ALL merge logic internally:
     * 1. Check local symbols (fresh buffer) first
     * 2. Fall back to indexed symbols (headers + static), excluding current file
     *
     * This design prevents asymmetric implementations - the filtering logic
     * lives in ONE place, not scattered across registry methods.
     *
     * @param name Symbol name to find
     * @param text Current document text
     * @param uri Current document URI
     * @returns IndexedSymbol if found, undefined otherwise
     */
    resolveSymbol?(name: string, text: string, uri: string): IndexedSymbol | undefined;

    /** Get completions for the document. Combines static + headers + file-specific. */
    getCompletions?(uri: string): CompletionItem[];

    /** Get signature help for a symbol. */
    getSignature?(uri: string, symbol: string, paramIndex: number): SignatureHelp | null;

    /** Get definition location for a symbol (data-driven, from headers). */
    getSymbolDefinition?(symbol: string): Location | null;

    // =========================================================================
    // File parsing (for user-defined functions, macros, etc.)
    // =========================================================================

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

