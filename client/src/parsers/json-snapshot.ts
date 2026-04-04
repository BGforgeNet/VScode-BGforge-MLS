import type { ParseResult } from "./types";

export function createBinaryJsonSnapshot(parseResult: ParseResult): string {
    return `${JSON.stringify(parseResult, null, 2)}\n`;
}

export function parseBinaryJsonSnapshot(jsonText: string): ParseResult {
    return JSON.parse(jsonText) as ParseResult;
}
