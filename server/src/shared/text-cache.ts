/**
 * Generic LRU text cache for parsed document data.
 *
 * Caches parsed results by URI with text hash validation.
 * Used by local-symbols modules to avoid re-parsing unchanged documents.
 */

/**
 * Simple hash function for cache keys.
 * Uses djb2 algorithm - fast and good distribution for strings.
 */
function hashText(text: string): number {
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) + hash) + text.charCodeAt(i);
        hash = hash >>> 0; // Convert to unsigned 32-bit
    }
    return hash;
}

/** Cache entry with hash and parsed data */
interface CacheEntry<T> {
    hash: number;
    data: T;
}

/** Default maximum cache entries */
const DEFAULT_MAX_SIZE = 50;

/**
 * Generic LRU cache for text-based parsing results.
 *
 * @typeParam T - The type of parsed data to cache
 */
export class TextCache<T> {
    private readonly cache = new Map<string, CacheEntry<T>>();
    private readonly maxSize: number;

    constructor(maxSize: number = DEFAULT_MAX_SIZE) {
        this.maxSize = maxSize;
    }

    /**
     * Get cached data or parse and cache new data.
     *
     * @param uri Document URI (cache key)
     * @param text Document text (used for hash validation)
     * @param parse Function to parse text into data (called on cache miss)
     * @returns Parsed data, or null if parse returns null
     */
    getOrParse(uri: string, text: string, parse: (text: string, uri: string) => T | null): T | null {
        const hash = hashText(text);

        // Check cache
        const cached = this.cache.get(uri);
        if (cached && cached.hash === hash) {
            return cached.data;
        }

        // Parse
        const data = parse(text, uri);
        if (data === null) {
            return null;
        }

        // Evict oldest if at capacity (Map maintains insertion order)
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey !== undefined) {
                this.cache.delete(oldestKey);
            }
        }

        this.cache.set(uri, { hash, data });
        return data;
    }

    /** Clear cache for a specific URI. */
    clear(uri: string): void {
        this.cache.delete(uri);
    }

    /** Clear entire cache. */
    clearAll(): void {
        this.cache.clear();
    }

    /** Get cache size (for testing/debugging). */
    get size(): number {
        return this.cache.size;
    }
}
