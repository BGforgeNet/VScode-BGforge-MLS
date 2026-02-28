/**
 * Shared tooltip formatting helpers for markdown hover/completion content.
 * Provides consistent code fence rendering and deprecation notices
 * across all language providers.
 */

/**
 * Build a markdown code fence block with optional file path.
 *
 * Output (without path):
 *   ```langId
 *   signature
 *   ```
 *
 * Output (with path):
 *   ```langId
 *   signature
 *   ```
 *   ```bgforge-mls-comment
 *   filePath
 *   ```
 */
export function buildSignatureBlock(signature: string, langId: string, filePath?: string): string {
    const parts = [`\`\`\`${langId}`, signature, "```"];
    if (filePath) {
        parts.push("```bgforge-mls-comment", filePath, "```");
    }
    return parts.join("\n");
}

/**
 * Format a deprecation notice for tooltip markdown.
 * Returns a string fragment to append to tooltip content.
 *
 * - undefined → "" (no notice)
 * - true → "\n\n**Deprecated**"
 * - "message" → "\n\n**Deprecated:** message"
 */
export function formatDeprecation(deprecated: boolean | string | undefined): string {
    if (deprecated === undefined) {
        return "";
    }
    if (deprecated === true) {
        return "\n\n**Deprecated**";
    }
    return `\n\n**Deprecated:** ${deprecated}`;
}
