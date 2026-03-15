/**
 * Shared tooltip formatting helpers for markdown hover/completion content.
 * Provides consistent code fence rendering, deprecation notices, and
 * WeiDU/TP2 hover composition across build-time and runtime paths.
 */

/** Build a markdown code fence block with optional file path. */
export function buildSignatureBlock(signature: string, langId: string, filePath?: string): string {
    const parts = [`\`\`\`${langId}`, signature, "```"];
    if (filePath) {
        parts.push("```bgforge-mls-comment", filePath, "```");
    }
    return parts.join("\n");
}

/** Format a deprecation notice for tooltip markdown. */
export function formatDeprecation(deprecated: boolean | string | undefined): string {
    if (deprecated === undefined) {
        return "";
    }
    if (deprecated === true) {
        return "\n\n**Deprecated**";
    }
    return `\n\n**Deprecated:** ${deprecated}`;
}

interface WeiduHoverParts {
    readonly signature: string;
    readonly langId: string;
    readonly filePath?: string;
    readonly description?: string;
    readonly paramTable?: string;
    readonly deprecated?: boolean | string;
}

/** Compose a complete WeiDU/TP2 hover tooltip from its parts. */
export function buildWeiduHoverContent(parts: WeiduHoverParts): string {
    let result = buildSignatureBlock(parts.signature, parts.langId, parts.filePath);

    if (parts.description) {
        result += "\n\n---\n\n" + parts.description;
    }

    if (parts.paramTable) {
        result += "\n\n" + parts.paramTable;
    }

    result += formatDeprecation(parts.deprecated);

    return result;
}
