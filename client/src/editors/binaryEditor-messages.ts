/**
 * Typed message protocol for binary editor webview <-> extension host communication.
 * All messages are serialized via postMessage as JSON.
 */

import type { ParseResult } from "../parsers";

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

export type WebviewToExtension = EditMessage | ReadyMessage;

// -- Extension -> Webview ---------------------------------------------------

export interface InitMessage {
    readonly type: "init";
    readonly parseResult: ParseResult;
    /** Enum lookup tables keyed by field type, e.g. { "Object Type": { 0: "Item", ... } } */
    readonly enums: Record<string, Record<number, string>>;
    /** Flag lookup tables keyed by field name */
    readonly flags: Record<string, Record<number, string>>;
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

export type ExtensionToWebview = InitMessage | UpdateFieldMessage | ValidationErrorMessage;
