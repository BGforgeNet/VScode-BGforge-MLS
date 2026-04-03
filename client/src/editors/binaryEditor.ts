/**
 * Custom editor provider for binary PRO files.
 * Displays parsed structure in an editable tree view with undo/redo and save.
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { BinaryParser, parserRegistry, ParseResult } from "../parsers";
import { escapeHtml } from "../utils";
import { BinaryDocument } from "./binaryEditor-document";
import { buildBinaryEditorTreeState, BinaryEditorTreeState } from "./binaryEditor-tree";
import { validateEnum, validateFlags } from "./binaryEditor-validation";
import type { WebviewToExtension, ExtensionToWebview, InitMessage } from "./binaryEditor-messages";
import { resolveDisplayValue, resolveEnumLookup, resolveFlagLookup } from "./binaryEditor-lookups";
import { BinaryEditorRefreshGate } from "./binaryEditor-refreshGate";
import { BinaryEditorLocalEditTracker } from "./binaryEditor-localEditTracker";

type EditableBinaryParser = BinaryParser & {
    serialize: NonNullable<BinaryParser["serialize"]>;
};

class BinaryEditorProvider implements vscode.CustomEditorProvider<BinaryDocument> {
    public static readonly viewType = "bgforge.binaryEditor";

    // Cached assets (loaded once per extension lifetime)
    private static cachedHtml: string | undefined;
    private static cachedCommonCss: string | undefined;
    private static cachedCss: string | undefined;
    private static cachedJs: string | undefined;
    private static cachedExtensionPath: string | undefined;

    private readonly extensionUri: vscode.Uri;

    /** Per-document disposables, cleaned up when document is disposed */
    private readonly documentSubscriptions = new Map<BinaryDocument, vscode.Disposable[]>();
    private readonly treeStates = new Map<BinaryDocument, BinaryEditorTreeState>();

    private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<BinaryDocument>>();
    readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

    constructor(context: vscode.ExtensionContext) {
        this.extensionUri = context.extensionUri;
    }

    // -- CustomEditorProvider lifecycle -------------------------------------

    async openCustomDocument(
        uri: vscode.Uri,
        _openContext: vscode.CustomDocumentOpenContext,
        _token: vscode.CancellationToken,
    ): Promise<BinaryDocument> {
        const { parseResult, parser } = await this.parseFile(uri);
        const doc = new BinaryDocument(uri, parseResult, parser.serialize.bind(parser));

        const subscriptions: vscode.Disposable[] = [];

        // Forward document edit events to VSCode for dirty tracking and undo/redo
        subscriptions.push(doc.onDidChange((e) => this._onDidChangeCustomDocument.fire(e)));

        // Clean up subscriptions when document is disposed
        subscriptions.push(doc.onDidDispose(() => {
            const subs = this.documentSubscriptions.get(doc);
            if (subs) {
                for (const sub of subs) sub.dispose();
                this.documentSubscriptions.delete(doc);
            }
            this.treeStates.delete(doc);
        }));

        this.documentSubscriptions.set(doc, subscriptions);

        return doc;
    }

    async resolveCustomEditor(
        document: BinaryDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken,
    ): Promise<void> {
        const refreshGate = new BinaryEditorRefreshGate();
        const localEditTracker = new BinaryEditorLocalEditTracker();

        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };

        // Set the initial HTML shell
        webviewPanel.webview.html = this.getHtmlShell(document);

        // Handle messages from webview
        webviewPanel.webview.onDidReceiveMessage((msg: WebviewToExtension) => {
            switch (msg.type) {
                case "ready":
                    this.sendInit(webviewPanel.webview, document);
                    break;
                case "getChildren":
                    this.sendChildren(webviewPanel.webview, document, msg.nodeId);
                    break;
                case "edit":
                    void this.handleEdit(webviewPanel.webview, document, msg.fieldPath, msg.value, refreshGate, localEditTracker);
                    break;
            }
        });

        // Re-send data when content changes (undo/redo)
        document.onDidChangeContent(() => {
            if (refreshGate.consumeShouldSkipFullRefresh()) {
                return;
            }
            localEditTracker.clear();
            this.sendInit(webviewPanel.webview, document);
        });
    }

    async saveCustomDocument(document: BinaryDocument, _cancellation: vscode.CancellationToken): Promise<void> {
        const bytes = document.getContent();
        await vscode.workspace.fs.writeFile(document.uri, bytes);
    }

    async saveCustomDocumentAs(document: BinaryDocument, destination: vscode.Uri, _cancellation: vscode.CancellationToken): Promise<void> {
        const bytes = document.getContent();
        await vscode.workspace.fs.writeFile(destination, bytes);
    }

    async revertCustomDocument(document: BinaryDocument, _cancellation: vscode.CancellationToken): Promise<void> {
        const { parseResult } = await this.parseFile(document.uri);
        document.reset(parseResult);
    }

    async backupCustomDocument(
        document: BinaryDocument,
        context: vscode.CustomDocumentBackupContext,
        _cancellation: vscode.CancellationToken,
    ): Promise<vscode.CustomDocumentBackup> {
        const bytes = document.getContent();
        await vscode.workspace.fs.writeFile(context.destination, bytes);
        return { id: context.destination.toString(), delete: () => vscode.workspace.fs.delete(context.destination) };
    }

    // -- Message handling ---------------------------------------------------

    private sendInit(webview: vscode.Webview, document: BinaryDocument): void {
        const treeState = buildBinaryEditorTreeState(document.parseResult);
        this.treeStates.set(document, treeState);
        const payload = treeState.getInitMessagePayload();
        const msg: InitMessage = {
            type: "init",
            format: payload.format,
            formatName: payload.formatName,
            rootChildren: payload.rootChildren,
            warnings: payload.warnings,
            errors: payload.errors,
            enums: {},
            flags: {},
        };
        webview.postMessage(msg);
    }

    private sendChildren(webview: vscode.Webview, document: BinaryDocument, nodeId: string): void {
        const treeState = this.treeStates.get(document) ?? buildBinaryEditorTreeState(document.parseResult);
        this.treeStates.set(document, treeState);
        const msg: ExtensionToWebview = {
            type: "children",
            nodeId,
            children: treeState.getChildren(nodeId),
        };
        webview.postMessage(msg);
    }

    private async handleEdit(
        webview: vscode.Webview,
        document: BinaryDocument,
        fieldPath: string,
        rawValue: number,
        refreshGate: BinaryEditorRefreshGate,
        localEditTracker: BinaryEditorLocalEditTracker,
    ): Promise<void> {
        // Determine validation context from field path
        const fieldName = fieldPath.split(".").pop() ?? "";
        const format = document.parseResult.format;

        if (localEditTracker.shouldUndo(fieldPath, rawValue)) {
            localEditTracker.clear();
            refreshGate.beginIncrementalEdit();
            await vscode.commands.executeCommand("undo");
            const displayValue = resolveDisplayValue(format, fieldPath, fieldName, rawValue);
            const msg: ExtensionToWebview = {
                type: "updateField",
                fieldPath,
                displayValue,
                rawValue,
            };
            webview.postMessage(msg);
            return;
        }

        // Validate enum fields
        const enumTable = resolveEnumLookup(format, fieldPath, fieldName);
        if (enumTable) {
            const err = validateEnum(rawValue, enumTable);
            if (err) {
                const msg: ExtensionToWebview = { type: "validationError", fieldPath, message: err };
                webview.postMessage(msg);
                return;
            }
        }

        // Validate flag fields
        const flagTable = resolveFlagLookup(format, fieldPath, fieldName);
        if (flagTable) {
            const err = validateFlags(rawValue, flagTable);
            if (err) {
                const msg: ExtensionToWebview = { type: "validationError", fieldPath, message: err };
                webview.postMessage(msg);
                return;
            }
        }

        // Compute display value
        const displayValue = resolveDisplayValue(format, fieldPath, fieldName, rawValue);

        // Apply edit
        refreshGate.beginIncrementalEdit();
        const edit = document.applyEdit(fieldPath, rawValue, displayValue);
        if (!edit) {
            refreshGate.cancelIncrementalEdit();
            const msg: ExtensionToWebview = { type: "validationError", fieldPath, message: `Field not found: ${fieldPath}` };
            webview.postMessage(msg);
            return;
        }
        localEditTracker.record(edit);

        const msg: ExtensionToWebview = {
            type: "updateField",
            fieldPath,
            displayValue,
            rawValue,
        };
        webview.postMessage(msg);
    }

    // -- File parsing -------------------------------------------------------

    private async parseFile(uri: vscode.Uri): Promise<{ parseResult: ParseResult; parser: EditableBinaryParser }> {
        const extension = path.extname(uri.fsPath);
        const parser = parserRegistry.getByExtension(extension);

        if (!parser?.serialize) {
            const parseResult: ParseResult = {
                format: "unknown",
                formatName: "Unknown Format",
                root: { name: "Error", fields: [], expanded: true },
                errors: [`No editable parser registered for extension: ${extension}`],
            };
            return {
                parseResult,
                parser: {
                    id: "unknown",
                    name: "Unknown",
                    extensions: [],
                    parse: () => parseResult,
                    serialize: () => new Uint8Array(),
                },
            };
        }

        const fileData = await vscode.workspace.fs.readFile(uri);
        return {
            parseResult: parser.parse(fileData),
            parser: parser as EditableBinaryParser,
        };
    }

    // -- HTML rendering (shell only, data sent via postMessage) --------------

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
            BinaryEditorProvider.cachedHtml = undefined;
            BinaryEditorProvider.cachedCommonCss = undefined;
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

    private getCommonCss(): string {
        if (!BinaryEditorProvider.cachedCommonCss) {
            BinaryEditorProvider.cachedCommonCss = this.loadAsset(path.join("client", "src", "webview-common.css"));
        }
        return BinaryEditorProvider.cachedCommonCss;
    }

    private getCss(): string {
        if (!BinaryEditorProvider.cachedCss) {
            BinaryEditorProvider.cachedCss = this.loadAsset(path.join("client", "src", "editors", "binaryEditor.css"));
        }
        return this.getCommonCss() + "\n" + BinaryEditorProvider.cachedCss;
    }

    private getJs(): string {
        if (!BinaryEditorProvider.cachedJs) {
            BinaryEditorProvider.cachedJs = this.loadAsset(path.join("client", "out", "editors", "binaryEditor-webview.js"));
        }
        return BinaryEditorProvider.cachedJs;
    }

    /**
     * Generate the HTML shell. The tree content is rendered client-side
     * from data sent via postMessage.
     */
    private getHtmlShell(document: BinaryDocument): string {
        const fileName = path.basename(document.uri.fsPath);
        return this.getHtmlTemplate()
            .replace(/\{\{fileName\}\}/g, escapeHtml(fileName))
            .replace("{{formatName}}", escapeHtml(document.parseResult.formatName))
            .replace("{{styles}}", this.getCss())
            .replace("{{errors}}", "")
            .replace("{{warnings}}", "")
            .replace("{{tree}}", '<div class="loading">Loading...</div>')
            .replace("/* __SCRIPT__ */", this.getJs());
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
