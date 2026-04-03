import * as fs from "fs";
import * as path from "path";

type AssetCacheEntry = {
    extensionPath: string;
    html?: string;
    css?: string;
    js?: string;
};

const assetCache = new Map<string, AssetCacheEntry>();

function loadAsset(extensionPath: string, relativePath: string): string {
    const fullPath = path.join(extensionPath, relativePath);
    return fs.readFileSync(fullPath, "utf8");
}

function getCacheEntry(cacheKey: string, extensionPath: string): AssetCacheEntry {
    const cached = assetCache.get(cacheKey);
    if (cached && cached.extensionPath === extensionPath) {
        return cached;
    }

    const entry: AssetCacheEntry = { extensionPath };
    assetCache.set(cacheKey, entry);
    return entry;
}

export function getCachedHtmlAsset(cacheKey: string, extensionPath: string, relativePath: string): string {
    const cacheEntry = getCacheEntry(cacheKey, extensionPath);
    if (!cacheEntry.html) {
        cacheEntry.html = loadAsset(extensionPath, relativePath);
    }
    return cacheEntry.html;
}

export function getCachedCssAsset(cacheKey: string, extensionPath: string, relativePaths: readonly string[]): string {
    const cacheEntry = getCacheEntry(cacheKey, extensionPath);
    if (!cacheEntry.css) {
        cacheEntry.css = relativePaths.map((relativePath) => loadAsset(extensionPath, relativePath)).join("\n");
    }
    return cacheEntry.css;
}

export function getCachedJsAsset(cacheKey: string, extensionPath: string, relativePath: string): string {
    const cacheEntry = getCacheEntry(cacheKey, extensionPath);
    if (!cacheEntry.js) {
        cacheEntry.js = loadAsset(extensionPath, relativePath);
    }
    return cacheEntry.js;
}
