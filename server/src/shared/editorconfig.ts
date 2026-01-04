/**
 * Shared editorconfig utilities.
 * Using 'ini' instead of 'editorconfig' package because editorconfig depends on
 * @one-ini/wasm which requires a .wasm file that doesn't bundle properly with esbuild.
 */

import * as fs from "fs";
import * as path from "path";
import { parse as parseIni } from "ini";

/**
 * Simple glob matching for editorconfig patterns.
 */
export function matchesGlob(fileName: string, pattern: string): boolean {
    if (pattern === "*") return true;
    if (pattern.startsWith("*.")) {
        const extPattern = pattern.slice(2);
        const braceMatch = extPattern.match(/^\{(.+)\}$/);
        if (braceMatch && braceMatch[1]) {
            const extensions = braceMatch[1].split(",");
            return extensions.some(ext => fileName.endsWith("." + ext.trim()));
        }
        return fileName.endsWith("." + extPattern);
    }
    return fileName === pattern;
}

/**
 * Gets indent_size from .editorconfig files, walking up the directory tree.
 */
export function getIndentFromEditorconfig(filePath: string): number | null {
    const fileName = path.basename(filePath);
    let dir = path.dirname(filePath);
    let result: number | null = null;

    while (true) {
        const configPath = path.join(dir, ".editorconfig");
        if (fs.existsSync(configPath)) {
            try {
                const content = fs.readFileSync(configPath, "utf-8");
                const config = parseIni(content);
                // Later matching sections override earlier ones
                for (const section of Object.keys(config)) {
                    if (matchesGlob(fileName, section)) {
                        const indent = config[section].indent_size;
                        if (typeof indent === "number") {
                            result = indent;
                        } else if (typeof indent === "string") {
                            const parsed = parseInt(indent, 10);
                            if (!isNaN(parsed)) result = parsed;
                        }
                    }
                }
                if (result !== null) return result;
                if (config.root === true || config.root === "true") break;
            } catch {
                // Ignore read errors
            }
        }
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return result;
}
