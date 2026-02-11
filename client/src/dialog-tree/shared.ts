/**
 * Shared infrastructure for dialog tree preview panels.
 * Asset caching, HTML assembly, escapeHtml, and panel lifecycle management
 * shared between SSL and D dialog previews.
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { LanguageClient, ExecuteCommandRequest, ExecuteCommandParams } from "vscode-languageclient/node";

// ---------------------------------------------------------------------------
// Asset caching -- reads from disk once, invalidated when extension updates
// ---------------------------------------------------------------------------

let cachedHtml: string | undefined;
let cachedCss: string | undefined;
let cachedJs: string | undefined;
let cachedExtensionPath: string | undefined;

function loadAsset(extensionPath: string, relativePath: string): string {
    const fullPath = path.join(extensionPath, relativePath);
    return fs.readFileSync(fullPath, "utf8");
}

/** Invalidate cache when extension path changes (e.g. after extension update). */
function invalidateCacheIfNeeded(extensionPath: string): void {
    if (cachedExtensionPath !== extensionPath) {
        cachedHtml = undefined;
        cachedCss = undefined;
        cachedJs = undefined;
        cachedExtensionPath = extensionPath;
    }
}

function getHtmlTemplate(extensionPath: string): string {
    if (!cachedHtml) {
        cachedHtml = loadAsset(extensionPath, path.join("client", "src", "dialog-tree", "dialogTree.html"));
    }
    return cachedHtml;
}

function getCss(extensionPath: string): string {
    if (!cachedCss) {
        cachedCss = loadAsset(extensionPath, path.join("client", "src", "dialog-tree", "dialogTree.css"));
    }
    return cachedCss;
}

function getJs(extensionPath: string): string {
    // Built by esbuild-webviews to client/out/
    if (!cachedJs) {
        cachedJs = loadAsset(extensionPath, path.join("client", "out", "dialog-tree", "dialogTree-webview.js"));
    }
    return cachedJs;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// HTML assembly
// ---------------------------------------------------------------------------

function getDialogPreviewHtml(treeContent: string, codiconsUri: string, extensionPath: string): string {
    invalidateCacheIfNeeded(extensionPath);
    // Function replacers prevent $-pattern interpretation in replacement strings
    // ($&, $', $` are special even with string search patterns).
    return getHtmlTemplate(extensionPath)
        .replace("{{codiconsUri}}", () => codiconsUri)
        .replace("{{cssUri}}", () => "")
        .replace("{{scriptUri}}", () => "")
        .replace('<link href="" rel="stylesheet" />', () => `<style>${getCss(extensionPath)}</style>`)
        .replace('<script src=""></script>', () => `<script>${getJs(extensionPath)}</script>`)
        .replace("{{treeContent}}", () => treeContent);
}

// ---------------------------------------------------------------------------
// Panel lifecycle
// ---------------------------------------------------------------------------

export interface DialogPanelConfig {
    /** Language ID that this panel handles (e.g. "fallout-ssl" or "weidu-d") */
    languageId: string;
    /** VS Code command ID (e.g. "extension.bgforge.dialogPreview") */
    commandName: string;
    /** Warning message shown when no matching file is open */
    warningMessage: string;
    /** Language ID of translation files that trigger refresh on save */
    translationLangId: string;
    /** Build the tree HTML from server response data */
    buildTreeHtml: (data: unknown) => string;
    /** Check if data is non-empty (to decide whether to show "no data" warning) */
    hasData: (data: unknown) => boolean;
}

/**
 * Register a dialog preview panel with shared lifecycle management.
 * Handles panel creation, debounced refresh, document change watching,
 * save watching, and command registration.
 */
export function registerDialogPanel(
    context: vscode.ExtensionContext,
    client: LanguageClient,
    config: DialogPanelConfig,
): void {
    let dialogPanel: vscode.WebviewPanel | undefined;
    let currentDocumentUri: string | undefined;
    let refreshTimeout: NodeJS.Timeout | undefined;

    async function refreshPreview() {
        if (!dialogPanel || !currentDocumentUri) return;

        const params: ExecuteCommandParams = {
            command: "bgforge.parseDialog",
            arguments: [{ uri: currentDocumentUri }],
        };

        try {
            const data = await client.sendRequest(ExecuteCommandRequest.type, params) as unknown;
            if (data == null || !config.hasData(data)) return;

            const treeContent = config.buildTreeHtml(data);
            const codiconsUri = dialogPanel.webview.asWebviewUri(
                vscode.Uri.joinPath(context.extensionUri, "node_modules", "@vscode/codicons", "dist", "codicon.css")
            );
            dialogPanel.webview.html = getDialogPreviewHtml(treeContent, codiconsUri.toString(), context.extensionUri.fsPath);
        } catch {
            // Ignore errors during refresh
        }
    }

    function scheduleRefresh() {
        if (refreshTimeout) {
            clearTimeout(refreshTimeout);
        }
        refreshTimeout = setTimeout(refreshPreview, 300);
    }

    // Watch for changes while editing
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (dialogPanel && e.document.uri.toString() === currentDocumentUri) {
                scheduleRefresh();
            }
        })
    );

    // Refresh on save (source file or translation file)
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument((doc) => {
            if (!dialogPanel) return;
            if (doc.uri.toString() === currentDocumentUri || doc.languageId === config.translationLangId) {
                void refreshPreview();
            }
        })
    );

    // Preview command
    context.subscriptions.push(
        vscode.commands.registerCommand(config.commandName, async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== config.languageId) {
                vscode.window.showWarningMessage(config.warningMessage);
                return;
            }

            currentDocumentUri = editor.document.uri.toString();

            const params: ExecuteCommandParams = {
                command: "bgforge.parseDialog",
                arguments: [{ uri: currentDocumentUri }],
            };

            try {
                const data = await client.sendRequest(ExecuteCommandRequest.type, params) as unknown;

                if (data == null || !config.hasData(data)) {
                    vscode.window.showWarningMessage("No dialog data found");
                    return;
                }

                const fileName = editor.document.fileName.split(/[/\\]/).pop() || "dialog";

                if (dialogPanel) {
                    dialogPanel.reveal(vscode.ViewColumn.Active);
                } else {
                    dialogPanel = vscode.window.createWebviewPanel(
                        "bgforgeDialogPreview",
                        `Dialog: ${fileName}`,
                        vscode.ViewColumn.Active,
                        { enableScripts: true, localResourceRoots: [context.extensionUri] }
                    );
                    dialogPanel.onDidDispose(() => {
                        dialogPanel = undefined;
                        currentDocumentUri = undefined;
                        if (refreshTimeout) {
                            clearTimeout(refreshTimeout);
                        }
                    });
                }

                const treeContent = config.buildTreeHtml(data);
                const codiconsUri = dialogPanel.webview.asWebviewUri(
                    vscode.Uri.joinPath(context.extensionUri, "node_modules", "@vscode/codicons", "dist", "codicon.css")
                );

                dialogPanel.title = `Dialog: ${fileName}`;
                dialogPanel.webview.html = getDialogPreviewHtml(treeContent, codiconsUri.toString(), context.extensionUri.fsPath);
            } catch {
                vscode.window.showErrorMessage("Failed to generate dialog preview");
            }
        })
    );
}
