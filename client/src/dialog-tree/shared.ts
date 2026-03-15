/**
 * Shared infrastructure for dialog tree preview panels.
 * Asset caching, HTML assembly, and panel lifecycle management
 * shared between SSL, D, and TD dialog previews.
 * escapeHtml is re-exported from ../utils.ts (single source of truth).
 * CSS is loaded from ../webview-common.css + ./dialogTree.css (shared with binaryEditor).
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { LanguageClient, ExecuteCommandRequest, ExecuteCommandParams } from "vscode-languageclient/node";
import { escapeHtml } from "../utils";
import { LSP_COMMAND_PARSE_DIALOG } from "../../../shared/protocol";

// ---------------------------------------------------------------------------
// Asset caching -- reads from disk once, invalidated when extension updates
// ---------------------------------------------------------------------------

let cachedHtml: string | undefined;
let cachedCommonCss: string | undefined;
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
        cachedCommonCss = undefined;
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

function getCommonCss(extensionPath: string): string {
    if (!cachedCommonCss) {
        cachedCommonCss = loadAsset(extensionPath, path.join("client", "src", "webview-common.css"));
    }
    return cachedCommonCss;
}

function getCss(extensionPath: string): string {
    if (!cachedCss) {
        cachedCss = loadAsset(extensionPath, path.join("client", "src", "dialog-tree", "dialogTree.css"));
    }
    return getCommonCss(extensionPath) + "\n" + cachedCss;
}

function getJs(extensionPath: string): string {
    // Built by esbuild-webviews to client/out/
    if (!cachedJs) {
        cachedJs = loadAsset(extensionPath, path.join("client", "out", "dialog-tree", "dialogTree-webview.js"));
    }
    return cachedJs;
}

// Re-export so dialog tree builders (dialogTree.ts, dialogTree-d.ts) can import from "./shared"
export { escapeHtml };

// ---------------------------------------------------------------------------
// HTML assembly
// ---------------------------------------------------------------------------

/** Convert "a/b/c.ssl" to breadcrumb HTML: "a > b > icon c.ssl" with chevron separators and file icon on the last segment. */
function buildBreadcrumbHtml(filePath: string, iconUri: string): string {
    const segments = filePath.split(/[/\\]/).filter(Boolean);
    if (segments.length === 0) return "";
    const separator = ' <span class="breadcrumb-sep codicon codicon-chevron-right"></span> ';
    return segments.map((s, i) => {
        const icon = i === segments.length - 1
            ? `<img class="breadcrumb-icon" src="${escapeHtml(iconUri)}" alt="" /> `
            : "";
        return `<span class="breadcrumb-segment">${icon}${escapeHtml(s)}</span>`;
    }).join(separator);
}

function getDialogPreviewHtml(treeContent: string, codiconsUri: string, extensionPath: string, fileName: string, filePath: string, iconUri: string): string {
    invalidateCacheIfNeeded(extensionPath);
    // Function replacers prevent $-pattern interpretation in replacement strings
    // ($&, $', $` are special even with string search patterns).
    return getHtmlTemplate(extensionPath)
        .replace("{{codiconsUri}}", () => codiconsUri)
        .replace("{{cssUri}}", () => "")
        .replace("{{scriptUri}}", () => "")
        .replace('<link href="" rel="stylesheet" />', () => `<style>${getCss(extensionPath)}</style>`)
        .replace('<script src=""></script>', () => `<script>${getJs(extensionPath)}</script>`)
        .replace("{{filePath}}", () => buildBreadcrumbHtml(filePath, iconUri))
        .replace("{{fileName}}", () => escapeHtml(fileName))
        .replace("{{treeContent}}", () => treeContent);
}

// ---------------------------------------------------------------------------
// Panel lifecycle
// ---------------------------------------------------------------------------

interface DialogPanelConfig {
    /** Check whether a document should use this panel. */
    matchDocument: (doc: vscode.TextDocument) => boolean;
    /** Warning message shown when no matching file is open */
    warningMessage: string;
    /** Language ID of translation files that trigger refresh on save */
    translationLangId: string;
    /** Build the tree HTML from server response data */
    buildTreeHtml: (data: unknown) => string;
    /** Check if data is non-empty (to decide whether to show "no data" warning) */
    hasData: (data: unknown) => boolean;
    /** Relative path within extension to the tab icon (e.g. "themes/icons/fallout-ssl.svg") */
    tabIconPath: string;
}

export interface DialogPreviewController {
    matchesDocument: (doc: vscode.TextDocument) => boolean;
    openPreview: () => Promise<void>;
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
): DialogPreviewController {
    let dialogPanel: vscode.WebviewPanel | undefined;
    let currentDocumentUri: string | undefined;
    let currentFileName: string | undefined;
    let currentFilePath: string | undefined;
    let refreshTimeout: NodeJS.Timeout | undefined;

    async function refreshPreview() {
        if (!dialogPanel || !currentDocumentUri) return;

        const params: ExecuteCommandParams = {
            command: LSP_COMMAND_PARSE_DIALOG,
            arguments: [{ uri: currentDocumentUri }],
        };

        try {
            const data = await client.sendRequest(ExecuteCommandRequest.type, params) as unknown;
            if (data == null || !config.hasData(data)) return;

            const treeContent = config.buildTreeHtml(data);
            const codiconsUri = dialogPanel.webview.asWebviewUri(
                vscode.Uri.joinPath(context.extensionUri, "client", "out", "codicons", "codicon.css")
            );
            const iconUri = dialogPanel.webview.asWebviewUri(
                vscode.Uri.joinPath(context.extensionUri, config.tabIconPath)
            );
            dialogPanel.webview.html = getDialogPreviewHtml(treeContent, codiconsUri.toString(), context.extensionUri.fsPath, currentFileName || "dialog", currentFilePath || "", iconUri.toString());
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

    async function openPreview() {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !config.matchDocument(editor.document)) {
            vscode.window.showWarningMessage(config.warningMessage);
            return;
        }

        currentDocumentUri = editor.document.uri.toString();

        const params: ExecuteCommandParams = {
            command: LSP_COMMAND_PARSE_DIALOG,
            arguments: [{ uri: currentDocumentUri }],
        };

        try {
            const data = await client.sendRequest(ExecuteCommandRequest.type, params) as unknown;

            if (data == null || !config.hasData(data)) {
                vscode.window.showWarningMessage("No dialog data found");
                return;
            }

            const fileName = editor.document.fileName.split(/[/\\]/).pop() || "dialog";
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
            const filePath = workspaceFolder
                ? path.relative(workspaceFolder.uri.fsPath, editor.document.fileName)
                : fileName;
            currentFileName = fileName;
            currentFilePath = filePath;

            if (dialogPanel) {
                dialogPanel.reveal(vscode.ViewColumn.Active);
            } else {
                dialogPanel = vscode.window.createWebviewPanel(
                    "bgforgeDialogPreview",
                    `Dialog: ${fileName}`,
                    vscode.ViewColumn.Active,
                    { enableScripts: true, localResourceRoots: [context.extensionUri] }
                );
                dialogPanel.iconPath = vscode.Uri.joinPath(context.extensionUri, config.tabIconPath);
                dialogPanel.onDidDispose(() => {
                    dialogPanel = undefined;
                    currentDocumentUri = undefined;
                    currentFileName = undefined;
                    currentFilePath = undefined;
                    if (refreshTimeout) {
                        clearTimeout(refreshTimeout);
                    }
                });
            }

            const treeContent = config.buildTreeHtml(data);
            const codiconsUri = dialogPanel.webview.asWebviewUri(
                vscode.Uri.joinPath(context.extensionUri, "client", "out", "codicons", "codicon.css")
            );
            const iconUri = dialogPanel.webview.asWebviewUri(
                vscode.Uri.joinPath(context.extensionUri, config.tabIconPath)
            );

            dialogPanel.title = `Dialog: ${fileName}`;
            dialogPanel.webview.html = getDialogPreviewHtml(treeContent, codiconsUri.toString(), context.extensionUri.fsPath, fileName, filePath, iconUri.toString());
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            // Log full stack trace to Developer Tools for debugging (showErrorMessage only gets the message)
            console.error("Dialog preview error:", error);
            vscode.window.showErrorMessage(`Failed to generate dialog preview: ${msg}`);
        }
    }

    return {
        matchesDocument: config.matchDocument,
        openPreview,
    };
}
