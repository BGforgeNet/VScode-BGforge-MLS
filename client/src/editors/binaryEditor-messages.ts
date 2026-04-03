/**
 * Typed message protocol for binary editor webview <-> extension host communication.
 * All messages are serialized via postMessage as JSON.
 */

export interface BinaryEditorNode {
    readonly id: string;
    readonly parentId: string;
    readonly kind: "group" | "field";
    readonly name: string;
    readonly description?: string;
    readonly expandable: boolean;
    readonly expanded?: boolean;
    readonly fieldPath?: string;
    readonly editable?: boolean;
    readonly value?: string;
    readonly rawValue?: number | string;
    readonly offset?: number;
    readonly size?: number;
    readonly valueType?: string;
    readonly numericFormat?: "decimal" | "hex32";
    readonly enumOptions?: Record<number, string>;
    readonly flagOptions?: Record<number, string>;
}

// -- Webview -> Extension ---------------------------------------------------

export interface EditMessage {
    readonly type: "edit";
    /** Dot-separated path from root to the field, e.g. "Header.Object Type" */
    readonly fieldPath: string;
    /** New raw numeric value */
    readonly value: number;
}

export interface ReadyMessage {
    readonly type: "ready";
}

export interface GetChildrenMessage {
    readonly type: "getChildren";
    readonly nodeId: string;
}

export type WebviewToExtension = EditMessage | ReadyMessage | GetChildrenMessage;

// -- Extension -> Webview ---------------------------------------------------

export interface InitMessage {
    readonly type: "init";
    readonly format: string;
    readonly formatName: string;
    readonly rootChildren: BinaryEditorNode[];
    readonly warnings?: string[];
    readonly errors?: string[];
}

export interface ChildrenMessage {
    readonly type: "children";
    readonly nodeId: string;
    readonly children: BinaryEditorNode[];
}

export interface UpdateFieldMessage {
    readonly type: "updateField";
    /** Dot-separated path to the changed field */
    readonly fieldPath: string;
    /** New display value */
    readonly displayValue: string;
    /** New raw value */
    readonly rawValue: number;
}

export interface ValidationErrorMessage {
    readonly type: "validationError";
    readonly fieldPath: string;
    readonly message: string;
}

export type ExtensionToWebview = InitMessage | ChildrenMessage | UpdateFieldMessage | ValidationErrorMessage;
