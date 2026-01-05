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
} from "vscode-languageserver/node";
import { MLSsettings } from "./settings";

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

    // =========================================================================
    // Document features (AST-based, operate on current text)
    // =========================================================================

    /** Format the document. Returns edits to apply, or empty array if no changes. */
    format?(text: string, uri: string): TextEdit[];

    /** Get document symbols (for outline view, Ctrl+Shift+O). */
    symbols?(text: string): DocumentSymbol[];

    /** Go to definition at position. For in-file definitions (e.g., state labels). */
    definition?(text: string, position: Position, uri: string): Location | null;

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

    /** Compile/validate the document. Returns diagnostics via the connection. */
    compile?(uri: string, text: string): Promise<void>;
}

