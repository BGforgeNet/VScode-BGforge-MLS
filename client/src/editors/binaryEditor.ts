import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { parserRegistry, ParseResult, ParsedField, ParsedGroup } from "../parsers";
import { escapeHtml } from "../utils";

/**
 * Custom editor provider for binary files.
 * Displays parsed structure in a tree view.
 */
// Maximum file size for binary viewer (1MB should be plenty for any game data file)
const MAX_FILE_SIZE = 1024 * 1024;

export class BinaryEditorProvider implements vscode.CustomReadonlyEditorProvider {
    public static readonly viewType = "bgforge.binaryViewer";

    // Cached assets (loaded once per extension lifetime)
    private static cachedHtml: string | undefined;
    private static cachedCss: string | undefined;
    private static cachedJs: string | undefined;
    private static cachedExtensionPath: string | undefined;

    private readonly extensionUri: vscode.Uri;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.extensionUri = context.extensionUri;
    }

    /**
     * Called when a custom document is opened.
     */
    async openCustomDocument(
        uri: vscode.Uri,
        _openContext: vscode.CustomDocumentOpenContext,
        _token: vscode.CancellationToken
    ): Promise<vscode.CustomDocument> {
        return { uri, dispose: () => {} };
    }

    /**
     * Called when the editor needs to be displayed.
     */
    async resolveCustomEditor(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };

        // Initial render
        await this.updateWebview(document.uri, webviewPanel);

        // Watch for file changes
        const watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(document.uri, "*")
        );
        watcher.onDidChange(async (uri) => {
            if (uri.fsPath === document.uri.fsPath) {
                await this.updateWebview(document.uri, webviewPanel);
            }
        });

        // Dispose watcher when panel closes
        webviewPanel.onDidDispose(() => watcher.dispose());
    }

    /**
     * Read, parse, and update webview content
     */
    private async updateWebview(uri: vscode.Uri, webviewPanel: vscode.WebviewPanel): Promise<void> {
        let fileData: Uint8Array;
        try {
            fileData = await vscode.workspace.fs.readFile(uri);
        } catch {
            webviewPanel.webview.html = `<html><body><h1>File not found</h1><p>${escapeHtml(uri.fsPath)}</p></body></html>`;
            return;
        }

        // Check file size limit
        if (fileData.length > MAX_FILE_SIZE) {
            webviewPanel.webview.html = `<html><body><h1>File too large</h1><p>File size: ${fileData.length} bytes, max: ${MAX_FILE_SIZE}</p></body></html>`;
            return;
        }

        const extension = path.extname(uri.fsPath);
        const parser = parserRegistry.getByExtension(extension);
        const fileName = path.basename(uri.fsPath);

        let parseResult: ParseResult;
        if (!parser) {
            parseResult = {
                format: "unknown",
                formatName: "Unknown Format",
                root: { name: "Error", fields: [] },
                errors: [`No parser registered for extension: ${extension}`],
            };
        } else {
            try {
                parseResult = parser.parse(fileData);
            } catch (err) {
                parseResult = {
                    format: "error",
                    formatName: "Parse Error",
                    root: { name: "Error", fields: [] },
                    errors: [err instanceof Error ? err.message : String(err)],
                };
            }
        }

        webviewPanel.webview.html = this.getHtmlContent(parseResult, fileName);
    }

    private loadAsset(relativePath: string): string {
        const fullPath = path.join(this.extensionUri.fsPath, relativePath);
        try {
            return fs.readFileSync(fullPath, "utf8");
        } catch (err) {
            const msg = `Failed to load ${relativePath}: ${err}`;
            console.error(msg);
            throw new Error(msg);
        }
    }

    private invalidateCacheIfNeeded(): void {
        const currentPath = this.extensionUri.fsPath;
        if (BinaryEditorProvider.cachedExtensionPath && BinaryEditorProvider.cachedExtensionPath !== currentPath) {
            // Extension path changed - invalidate cache
            BinaryEditorProvider.cachedHtml = undefined;
            BinaryEditorProvider.cachedCss = undefined;
            BinaryEditorProvider.cachedJs = undefined;
        }
        BinaryEditorProvider.cachedExtensionPath = currentPath;
    }

    private getHtmlTemplate(): string {
        this.invalidateCacheIfNeeded();
        if (!BinaryEditorProvider.cachedHtml) {
            BinaryEditorProvider.cachedHtml = this.loadAsset(path.join("client", "src", "editors", "binaryEditor.html"));
        }
        return BinaryEditorProvider.cachedHtml;
    }

    private getCss(): string {
        if (!BinaryEditorProvider.cachedCss) {
            BinaryEditorProvider.cachedCss = this.loadAsset(path.join("client", "src", "editors", "binaryEditor.css"));
        }
        return BinaryEditorProvider.cachedCss;
    }

    private getJs(): string {
        if (!BinaryEditorProvider.cachedJs) {
            // Built by esbuild-webviews - preserves editors/ subdir
            BinaryEditorProvider.cachedJs = this.loadAsset(path.join("client", "out", "editors", "binaryEditor-webview.js"));
        }
        return BinaryEditorProvider.cachedJs;
    }

    /**
     * Generate HTML content for the webview
     */
    private getHtmlContent(parseResult: ParseResult, fileName: string): string {
        const errorsHtml = parseResult.errors?.length
            ? `<div class="errors">${parseResult.errors.map((e) => `<div>${escapeHtml(e)}</div>`).join("")}</div>`
            : "";

        const warningsHtml = parseResult.warnings?.length
            ? `<div class="warnings">${parseResult.warnings.map((w) => `<div>${escapeHtml(w)}</div>`).join("")}</div>`
            : "";

        return this.getHtmlTemplate()
            .replace(/\{\{fileName\}\}/g, escapeHtml(fileName))
            .replace("{{formatName}}", escapeHtml(parseResult.formatName))
            .replace("{{styles}}", this.getCss())
            .replace("{{errors}}", errorsHtml)
            .replace("{{warnings}}", warningsHtml)
            .replace("{{tree}}", parseResult.root.fields.map((child) => this.renderNode(child)).join(""))
            .replace("/* __SCRIPT__ */", this.getJs());
    }

    /**
     * Render a node (field or group) to HTML
     */
    private renderNode(node: ParsedField | ParsedGroup): string {
        if ("fields" in node) {
            // It's a group
            const expanded = node.expanded !== false ? "expanded" : "";
            const children = node.fields.map((child) => this.renderNode(child)).join("");
            return `
                <div class="group ${expanded}">
                    <div class="group-header">
                        <span class="group-name">${escapeHtml(node.name)}</span>
                    </div>
                    <div class="group-content">
                        ${children}
                    </div>
                </div>
            `;
        } else {
            // It's a field
            const valueClass = this.getValueClass(node.type || "");
            const offset =
                node.offset !== undefined ? `0x${node.offset.toString(16).toUpperCase().padStart(4, "0")}` : "";
            return `
                <div class="field">
                    <span class="field-name">${escapeHtml(node.name)}:</span>
                    <span class="field-value ${valueClass}">${escapeHtml(String(node.value))}</span>
                    ${offset ? `<span class="field-offset">[${offset}]</span>` : ""}
                    ${node.type ? `<span class="field-type">${escapeHtml(node.type)}</span>` : ""}
                </div>
            `;
        }
    }

    /**
     * Get CSS class for value based on type
     */
    private getValueClass(type: string): string {
        if (type.includes("int") || type.includes("uint")) return "number";
        if (type === "enum") return "enum";
        return "";
    }
}

/**
 * Register the binary editor provider
 */
export function registerBinaryEditor(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new BinaryEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(BinaryEditorProvider.viewType, provider, {
        supportsMultipleEditorsPerDocument: true,
        webviewOptions: {
            retainContextWhenHidden: true,
        },
    });
}
