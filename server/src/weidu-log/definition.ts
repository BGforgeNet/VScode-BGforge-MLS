/**
 * Go to Definition for WeiDU log files.
 * Resolves ~path/to/mod.tp2~ entries to the corresponding .tp2 file,
 * using case-insensitive path resolution (WeiDU paths are case-insensitive).
 */

import * as fs from "fs";
import * as path from "path";
import { Location, Position } from "vscode-languageserver/node";
import { uriToPath, pathToUri } from "../common";

/**
 * Get definition for the mod path under the cursor in a weidu.log file.
 * Parses ~path~ entries and resolves them case-insensitively relative to the log file.
 */
export function getDefinition(text: string, uri: string, position: Position): Location | null {
    const lines = text.split("\n");
    const line = lines[position.line];
    if (!line) {
        return null;
    }

    // Find ~path~ span that contains the cursor
    const modPathRegex = /~([^~]+)~/g;
    let match: RegExpExecArray | null;
    while ((match = modPathRegex.exec(line)) !== null) {
        const innerMatch = match[1];
        if (!innerMatch) {
            continue;
        }
        const matchStart = match.index + 1; // after opening ~
        const matchEnd = matchStart + innerMatch.length; // before closing ~
        if (position.character >= matchStart && position.character < matchEnd) {
            return resolveModPath(innerMatch, uri);
        }
    }

    return null;
}

/**
 * Resolve a mod path (e.g. "ALTERNATIVES/SETUP-ALTERNATIVES.TP2") to a file Location.
 * The path is resolved case-insensitively relative to the weidu.log file's directory.
 */
function resolveModPath(modPath: string, uri: string): Location | null {
    const logFilePath = uriToPath(uri);
    const logDir = path.dirname(logFilePath);
    const resolved = resolveCaseInsensitive(logDir, modPath);
    if (!resolved) {
        return null;
    }

    return {
        uri: pathToUri(resolved),
        range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 },
        },
    };
}

/**
 * Resolve a relative path case-insensitively by walking each path segment
 * and matching against actual directory entries.
 * Returns the resolved absolute path, or null if not found.
 */
function resolveCaseInsensitive(baseDir: string, relativePath: string): string | null {
    const segments = relativePath.split(/[/\\]/);
    let current = baseDir;

    for (const segment of segments) {
        let entries: string[];
        try {
            entries = fs.readdirSync(current);
        } catch {
            return null;
        }

        const found = entries.find((entry) => entry.toLowerCase() === segment.toLowerCase());
        if (!found) {
            return null;
        }

        current = path.join(current, found);
    }

    // Verify the final path is a file
    try {
        if (!fs.statSync(current).isFile()) {
            return null;
        }
    } catch {
        return null;
    }

    return current;
}
