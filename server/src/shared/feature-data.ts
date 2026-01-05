/**
 * Unified feature data containers and reload utilities.
 * Provides generic structures for the self/headers/extHeaders/static pattern
 * used across completion, hover, and signature features.
 */

/**
 * Base interface for items that belong to a specific file.
 * Used to filter items during reload operations.
 */
export interface UriItem {
    uri: string;
}

/**
 * Generic data container for list-based features (e.g., completion).
 * Items are stored as arrays and merged on query.
 */
export interface ListData<T, TStatic = T> {
    /** Per-document items: uri → item list */
    self: Map<string, T[]>;
    /** Items from workspace headers */
    headers: T[];
    /** Items from external headers directory */
    extHeaders?: T[];
    /** Built-in static items */
    static: TStatic[];
}

/**
 * Generic data container for map-based features (e.g., hover, signature).
 * Items are stored as maps keyed by symbol name.
 */
export interface MapData<T, TStatic = T> {
    /** Per-document items: uri → (symbol → item) */
    self: Map<string, Map<string, T>>;
    /** Items from workspace headers: symbol → item */
    headers: Map<string, T>;
    /** Items from external headers: symbol → item */
    extHeaders?: Map<string, T>;
    /** Built-in static items: symbol → item */
    static: Map<string, TStatic>;
}

/**
 * Creates an empty list-based data container.
 */
export function createEmptyListData<T, TStatic = T>(): ListData<T, TStatic> {
    return {
        self: new Map(),
        headers: [],
        static: [],
    };
}

/**
 * Creates an empty map-based data container.
 */
export function createEmptyMapData<T, TStatic = T>(): MapData<T, TStatic> {
    return {
        self: new Map(),
        headers: new Map(),
        static: new Map(),
    };
}

/**
 * Reload list data for a specific URI.
 * Filters out old items from that URI, de-duplicates against static keys, and merges.
 *
 * @param existing Current list of items
 * @param incoming New items from the reloaded file
 * @param uri URI of the file being reloaded
 * @param staticKeys Set of keys that exist in static data (to avoid duplicates)
 * @param getKey Function to extract the key from an item
 * @returns Merged list with old items from URI removed and new items added
 */
export function reloadList<T extends UriItem>(
    existing: T[],
    incoming: T[],
    uri: string,
    staticKeys: Map<string, unknown> | Set<string>,
    getKey: (item: T) => string
): T[] {
    // Remove old items from this URI
    const filtered = existing.filter((item) => item.uri !== uri);
    // Remove items that duplicate static entries
    const deduped = incoming.filter((item) => !staticKeys.has(getKey(item)));
    return [...filtered, ...deduped];
}

/**
 * Reload map data for a specific URI.
 * Filters out old items from that URI, de-duplicates against static keys, and merges.
 *
 * @param existing Current map of items
 * @param incoming New items from the reloaded file
 * @param uri URI of the file being reloaded
 * @param staticKeys Map of keys that exist in static data (to avoid duplicates)
 * @returns Merged map with old items from URI removed and new items added
 */
export function reloadMap<T extends UriItem>(
    existing: Map<string, T>,
    incoming: Map<string, T>,
    uri: string,
    staticKeys: Map<string, unknown>
): Map<string, T> {
    // Remove old items from this URI
    const filtered = new Map(Array.from(existing).filter(([, value]) => value.uri !== uri));
    // Remove items that duplicate static entries
    const deduped = new Map(Array.from(incoming).filter(([key]) => !staticKeys.has(key)));
    return new Map([...filtered, ...deduped]);
}

/**
 * Get all items from list data for a specific URI.
 * Combines self, headers, extHeaders, and static items.
 */
export function getListItems<T, TStatic>(
    data: ListData<T, TStatic>,
    uri: string
): (T | TStatic)[] {
    const selfItems = data.self.get(uri) ?? [];
    let result: (T | TStatic)[] = [...selfItems, ...data.static, ...data.headers];
    if (data.extHeaders) {
        result = [...result, ...data.extHeaders];
    }
    return result;
}

/**
 * Lookup a symbol in map data for a specific URI.
 * Checks in order: self → static → headers → extHeaders
 * Returns the first match found.
 */
export function lookupMapItem<T, TStatic>(
    data: MapData<T, TStatic>,
    uri: string,
    symbol: string
): T | TStatic | undefined {
    // Check self first
    const selfMap = data.self.get(uri);
    if (selfMap) {
        const item = selfMap.get(symbol);
        if (item) return item;
    }

    // Check static
    const staticItem = data.static.get(symbol);
    if (staticItem) return staticItem;

    // Check headers
    const headerItem = data.headers.get(symbol);
    if (headerItem) return headerItem;

    // Check external headers
    if (data.extHeaders) {
        const extItem = data.extHeaders.get(symbol);
        if (extItem) return extItem;
    }

    return undefined;
}
