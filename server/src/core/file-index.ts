/**
 * Coordinator for Symbols and ReferencesIndex stores.
 *
 * Ensures both stores are updated in lockstep from a single ParseResult,
 * preventing inconsistencies where one store is updated but the other is not.
 */

import type { NormalizedUri } from "./normalized-uri";
import type { IndexedSymbol } from "./symbol";
import type { ParseResult } from "./parse-result";
import { Symbols } from "./symbol-index";
import { ReferencesIndex } from "../shared/references-index";

/**
 * Wraps Symbols + ReferencesIndex with a single update/remove API.
 * Stores are exposed as readonly for query access by provider features.
 */
export class FileIndex {
    readonly symbols = new Symbols();
    readonly refs = new ReferencesIndex();

    /** Update both stores from a unified parse result. */
    updateFile(uri: NormalizedUri, result: ParseResult): void {
        this.symbols.updateFile(uri, result.symbols);
        this.refs.updateFile(uri, result.refs);
    }

    /** Remove a file from both stores. */
    removeFile(uri: NormalizedUri): void {
        this.symbols.clearFile(uri);
        this.refs.removeFile(uri);
    }

    /** Load static (built-in) symbols into the symbol store. */
    loadStatic(symbols: readonly IndexedSymbol[]): void {
        this.symbols.loadStatic(symbols);
    }
}
