/**
 * Custom editor provider for binary PRO files.
 * Displays parsed structure in an editable tree view with undo/redo and save.
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { parserRegistry, ParseResult } from "../parsers";
import { escapeHtml } from "../utils";
import { ProDocument } from "./binaryEditor-document";
import { validateEnum, validateFlags } from "./binaryEditor-validation";
import type { WebviewToExtension, ExtensionToWebview, InitMessage } from "./binaryEditor-messages";
import {
    ObjectType, ItemSubType, ScenerySubType, DamageType, MaterialType,
    FRMType, BodyType, KillType, ElevatorType, WeaponAnimCode, StatType,
    HeaderFlags, ItemFlagsExt, WallLightFlags, ActionFlags, ContainerFlags, CritterFlags,
    ScriptType,
} from "../parsers/pro-types";

// Maximum file size for binary viewer (1MB should be plenty for any game data file)
const MAX_FILE_SIZE = 1024 * 1024;

/** Enum lookup tables keyed by field name as shown in the UI */
const ENUM_TABLES: Record<string, Record<number, string>> = {
    "Object Type": ObjectType,
    "FRM Type": FRMType,
    "Sub Type": { ...ItemSubType, ...ScenerySubType },
    "Material": MaterialType,
    "Damage Type": DamageType,
    "Body Type": BodyType,
    "Kill Type": KillType,
    "Elevator Type": ElevatorType,
    "Animation Code": WeaponAnimCode,
    "Stat 0": StatType,
    "Stat 1": StatType,
    "Stat 2": StatType,
    "Script Type": ScriptType,
    "Gender": { 0: "Male", 1: "Female" },
};

/** Flag lookup tables keyed by field name */
const FLAG_TABLES: Record<string, Record<number, string>> = {
    "Flags": HeaderFlags,
    "Flags Ext": ItemFlagsExt,
    "Wall Light Flags": WallLightFlags,
    "Action Flags": ActionFlags,
    "Open Flags": ContainerFlags,
    "Critter Flags": CritterFlags,
};

class BinaryEditorProvider implements vscode.CustomEditorProvider<ProDocument> {
    public static readonly viewType = "bgforge.binaryEditor";

    // Cached assets (loaded once per extension lifetime)
    private static cachedHtml: string | undefined;
    private static cachedCommonCss: string | undefined;
    private static cachedCss: string | undefined;
    private static cachedJs: string | undefined;
    private static cachedExtensionPath: string | undefined;

    private readonly extensionUri: vscode.Uri;

    /** Per-document disposables, cleaned up when document is disposed */
    private readonly documentSubscriptions = new Map<ProDocument, vscode.Disposable[]>();

    private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<ProDocument>>();
    readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

    constructor(context: vscode.ExtensionContext) {
        this.extensionUri = context.extensionUri;
    }

    // -- CustomEditorProvider lifecycle -------------------------------------

    async openCustomDocument(
        uri: vscode.Uri,
        _openContext: vscode.CustomDocumentOpenContext,
        _token: vscode.CancellationToken,
    ): Promise<ProDocument> {
        const parseResult = await this.parseFile(uri);
        const doc = new ProDocument(uri, parseResult);

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
        }));

        this.documentSubscriptions.set(doc, subscriptions);

        return doc;
    }

    async resolveCustomEditor(
        document: ProDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken,
    ): Promise<void> {
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
                case "edit":
                    this.handleEdit(webviewPanel.webview, document, msg.fieldPath, msg.value);
                    break;
            }
        });

        // Re-send data when content changes (undo/redo)
        document.onDidChangeContent(() => {
            this.sendInit(webviewPanel.webview, document);
        });
    }

    async saveCustomDocument(document: ProDocument, _cancellation: vscode.CancellationToken): Promise<void> {
        const bytes = document.getContent();
        await vscode.workspace.fs.writeFile(document.uri, bytes);
    }

    async saveCustomDocumentAs(document: ProDocument, destination: vscode.Uri, _cancellation: vscode.CancellationToken): Promise<void> {
        const bytes = document.getContent();
        await vscode.workspace.fs.writeFile(destination, bytes);
    }

    async revertCustomDocument(document: ProDocument, _cancellation: vscode.CancellationToken): Promise<void> {
        const parseResult = await this.parseFile(document.uri);
        document.reset(parseResult);
    }

    async backupCustomDocument(
        document: ProDocument,
        context: vscode.CustomDocumentBackupContext,
        _cancellation: vscode.CancellationToken,
    ): Promise<vscode.CustomDocumentBackup> {
        const bytes = document.getContent();
        await vscode.workspace.fs.writeFile(context.destination, bytes);
        return { id: context.destination.toString(), delete: () => vscode.workspace.fs.delete(context.destination) };
    }

    // -- Message handling ---------------------------------------------------

    private sendInit(webview: vscode.Webview, document: ProDocument): void {
        const msg: InitMessage = {
            type: "init",
            parseResult: document.parseResult,
            enums: ENUM_TABLES,
            flags: FLAG_TABLES,
        };
        webview.postMessage(msg);
    }

    private handleEdit(webview: vscode.Webview, document: ProDocument, fieldPath: string, rawValue: number): void {
        // Determine validation context from field path
        const fieldName = fieldPath.split(".").pop() ?? "";

        // Validate enum fields
        const enumTable = ENUM_TABLES[fieldName];
        if (enumTable) {
            const err = validateEnum(rawValue, enumTable);
            if (err) {
                const msg: ExtensionToWebview = { type: "validationError", fieldPath, message: err };
                webview.postMessage(msg);
                return;
            }
        }

        // Validate flag fields
        const flagTable = FLAG_TABLES[fieldName];
        if (flagTable) {
            const err = validateFlags(rawValue, flagTable);
            if (err) {
                const msg: ExtensionToWebview = { type: "validationError", fieldPath, message: err };
                webview.postMessage(msg);
                return;
            }
        }

        // Compute display value
        const displayValue = this.computeDisplayValue(fieldName, rawValue);

        // Apply edit
        const edit = document.applyEdit(fieldPath, rawValue, displayValue);
        if (!edit) {
            const msg: ExtensionToWebview = { type: "validationError", fieldPath, message: `Field not found: ${fieldPath}` };
            webview.postMessage(msg);
        }
    }

    /**
     * Compute display value from raw value for a given field name.
     */
    private computeDisplayValue(fieldName: string, rawValue: number): string {
        const enumTable = ENUM_TABLES[fieldName];
        if (enumTable) {
            return enumTable[rawValue] ?? `Unknown (${rawValue})`;
        }

        const flagTable = FLAG_TABLES[fieldName];
        if (flagTable) {
            const flags: string[] = [];
            for (const [bit, name] of Object.entries(flagTable)) {
                const bitVal = Number(bit);
                if (bitVal === 0) {
                    if (rawValue === 0) flags.push(name);
                } else if (rawValue & bitVal) {
                    flags.push(name);
                }
            }
            return flags.length > 0 ? flags.join(", ") : "(none)";
        }

        return String(rawValue);
    }

    // -- File parsing -------------------------------------------------------

    private async parseFile(uri: vscode.Uri): Promise<ParseResult> {
        const fileData = await vscode.workspace.fs.readFile(uri);

        if (fileData.length > MAX_FILE_SIZE) {
            return {
                format: "error",
                formatName: "Error",
                root: { name: "Error", fields: [], expanded: true },
                errors: [`File too large: ${fileData.length} bytes, max: ${MAX_FILE_SIZE}`],
            };
        }

        const extension = path.extname(uri.fsPath);
        const parser = parserRegistry.getByExtension(extension);

        if (!parser) {
            return {
                format: "unknown",
                formatName: "Unknown Format",
                root: { name: "Error", fields: [], expanded: true },
                errors: [`No parser registered for extension: ${extension}`],
            };
        }

        return parser.parse(fileData);
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
    private getHtmlShell(document: ProDocument): string {
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
