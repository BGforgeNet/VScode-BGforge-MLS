/**
 * Shared tooltip formatting helpers for markdown hover/completion content.
 * Provides consistent code fence rendering, deprecation notices, and
 * WeiDU/TP2 hover composition across build-time (YAML) and runtime (JSDoc) paths.
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

/**
 * Options for composing a WeiDU/TP2 hover tooltip.
 * Used by both build-time (YAML items) and runtime (JSDoc-parsed functions/variables).
 */
interface WeiduHoverParts {
    /** Signature line (e.g., "action function MY_FUNC" or "int my_var = 42"). */
    readonly signature: string;
    /** Language ID for the code fence (e.g., "weidu-tp2-tooltip"). */
    readonly langId: string;
    /** File path shown below signature. Omit to skip. */
    readonly filePath?: string;
    /** Prose description (from JSDoc @desc or YAML doc field). */
    readonly description?: string;
    /** Pre-rendered parameter table markdown (from buildWeiduTable). */
    readonly paramTable?: string;
    /** Deprecation flag or message (from JSDoc @deprecated or YAML deprecated field). */
    readonly deprecated?: boolean | string;
}

/**
 * Compose a complete WeiDU/TP2 hover tooltip from its parts.
 * Ensures identical structure for both static (YAML) and runtime (JSDoc) data:
 *
 *   1. Signature code fence (with optional file path)
 *   2. Horizontal rule + description
 *   3. Parameter table
 *   4. Deprecation notice
 */
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
