/**
 * Shared djb2 hash function for cache keys.
 * Used by text-cache and parser-factory to avoid re-parsing unchanged content.
 */

/**
 * djb2 hash - fast with good distribution for strings.
 * Returns an unsigned 32-bit integer.
 */
export function djb2Hash(text: string): number {
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
    }
    return hash;
}

/**
 * djb2 hash returning a hex string key.
 * Suitable for Map cache keys where string keys are preferred.
 */
export function djb2HashHex(text: string): string {
    return djb2Hash(text).toString(16);
}
