/**
 * BinaryDocument: custom document model for the binary editor.
 * Holds the current ParseResult and raw bytes, supports editing fields,
 * and integrates with VSCode's undo/redo via CustomDocumentEditEvent.
 */

import * as vscode from "vscode";
import { BinaryParser, ParseResult, ParsedField, ParsedGroup } from "../parsers";

/**
 * Represents a single field edit for undo/redo.
 */
export interface FieldEdit {
    readonly fieldPath: string;
    readonly oldRawValue: number;
    readonly oldDisplayValue: string;
    readonly newRawValue: number;
    readonly newDisplayValue: string;
}

/**
 * Custom document for binary files handled by a registered parser.
 * Manages parsed state and exposes an edit API.
 */
export class BinaryDocument implements vscode.CustomDocument {
    readonly uri: vscode.Uri;
    private _parseResult: ParseResult;
    private readonly serializer: NonNullable<BinaryParser["serialize"]>;

    private readonly _onDidDispose = new vscode.EventEmitter<void>();
    readonly onDidDispose = this._onDidDispose.event;

    private readonly _onDidChange = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<BinaryDocument>>();
    /** VSCode listens to this for dirty state and undo/redo */
    readonly onDidChange = this._onDidChange.event;

    private readonly _onDidChangeContent = new vscode.EventEmitter<void>();
    /** Internal event: content changed, webview should refresh */
    readonly onDidChangeContent = this._onDidChangeContent.event;

    constructor(uri: vscode.Uri, parseResult: ParseResult, serializer: NonNullable<BinaryParser["serialize"]>) {
        this.uri = uri;
        this._parseResult = parseResult;
        this.serializer = serializer;
    }

    get parseResult(): ParseResult {
        return this._parseResult;
    }

    getField(fieldPath: string): ParsedField | undefined {
        return this.findField(fieldPath);
    }

    /**
     * Serialize the current state back to binary bytes.
     */
    getContent(): Uint8Array {
        return this.serializer(this._parseResult);
    }

    /**
     * Reset to a freshly-parsed result (used by revert).
     */
    reset(parseResult: ParseResult): void {
        this._parseResult = parseResult;
        this._onDidChangeContent.fire();
    }

    /**
     * Apply an edit to a field. Fires onDidChange for VSCode undo integration.
     * Returns the edit if successful, undefined if field not found.
     */
    applyEdit(fieldPath: string, newRawValue: number, newDisplayValue: string): FieldEdit | undefined {
        const field = this.findField(fieldPath);
        if (!field) return undefined;

        const oldRawValue = typeof field.rawValue === "number" ? field.rawValue : (typeof field.value === "number" ? field.value : 0);
        const oldDisplayValue = String(field.value);

        const edit: FieldEdit = {
            fieldPath,
            oldRawValue,
            oldDisplayValue,
            newRawValue,
            newDisplayValue,
        };

        // Apply the edit
        this.setFieldValue(field, newRawValue, newDisplayValue);

        // Fire VSCode edit event with undo/redo callbacks.
        // The label is shown in VSCode's Edit > Undo menu.
        this._onDidChange.fire({
            document: this,
            label: `Edit ${fieldPath}`,
            undo: () => {
                this.setFieldValue(field, oldRawValue, oldDisplayValue);
                this._onDidChangeContent.fire();
            },
            redo: () => {
                this.setFieldValue(field, newRawValue, newDisplayValue);
                this._onDidChangeContent.fire();
            },
        });

        this._onDidChangeContent.fire();
        return edit;
    }

    /**
     * Find a field by its dot-separated path (e.g. "Header.Object Type").
     */
    private findField(fieldPath: string): ParsedField | undefined {
        const parts = fieldPath.split(".");
        return findFieldInGroup(this._parseResult.root, parts, 0);
    }

    /**
     * Set a field's raw and display values.
     */
    private setFieldValue(field: ParsedField, rawValue: number, displayValue: string): void {
        // Mutating in-place is intentional here: the ParseResult tree is owned
        // by this document, and immutable copies would require rebuilding the
        // entire tree for every edit. Since PRO files are small and the tree
        // is never shared, in-place updates are safe and much simpler.
        (field as { value: unknown }).value = displayValue;
        (field as { rawValue?: number | string }).rawValue = rawValue;
    }

    dispose(): void {
        this._onDidDispose.fire();
        this._onDidDispose.dispose();
        this._onDidChange.dispose();
        this._onDidChangeContent.dispose();
    }
}

/**
 * Recursively search for a field in the ParseResult tree by path segments.
 */
function findFieldInGroup(
    group: ParsedGroup,
    pathParts: readonly string[],
    depth: number,
): ParsedField | undefined {
    for (const entry of group.fields) {
        if ("fields" in entry) {
            // It's a group — if the name matches the current path segment, recurse
            if (entry.name === pathParts[depth]) {
                const result = findFieldInGroup(entry, pathParts, depth + 1);
                if (result) return result;
            }
            // Also search without matching (groups may be skipped in the path)
            const result = findFieldInGroup(entry, pathParts, depth);
            if (result) return result;
        } else {
            // It's a field — check if the name matches the last path segment
            if (entry.name === pathParts[depth] && depth === pathParts.length - 1) {
                return entry;
            }
        }
    }
    return undefined;
}
