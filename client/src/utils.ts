/**
 * Shared utility functions for client extension code.
 * Note: dialogTree-webview.ts has its own copy of escapeHtml because
 * it runs in a separate webview bundle (built by esbuild independently).
 */

/**
 * Escape HTML special characters to prevent XSS.
 * Single source of truth -- imported by shared.ts and binaryEditor.ts.
 */
export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
