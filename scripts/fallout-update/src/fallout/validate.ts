/**
 * Runtime validation for YAML-parsed sfall data.
 * Each validator takes unknown input and returns a typed value or throws
 * a descriptive error. Used at every YAML.parse() boundary.
 */

import type { FalloutArg, SfallCategory, SfallFunction, SfallHook } from "./types.js";

/**
 * Validates that a value is a non-null object. Throws with context on failure.
 */
function assertObject(data: unknown, context: string): Record<string, unknown> {
    if (typeof data !== "object" || data === null) {
        throw new Error(`Expected object in ${context}, got ${data === null ? "null" : typeof data}`);
    }
    return data as Record<string, unknown>;
}

/**
 * Validates that a value is an array. Throws with context on failure.
 */
function assertArray(data: unknown, context: string): readonly unknown[] {
    if (!Array.isArray(data)) {
        throw new Error(`Expected array in ${context}, got ${typeof data}`);
    }
    return data as readonly unknown[];
}

/**
 * Validates that a field is a string. Throws with field name and context on failure.
 */
function requireString(record: Record<string, unknown>, field: string, context: string): string {
    const value = record[field];
    if (typeof value !== "string") {
        throw new Error(`Missing or invalid '${field}' (expected string) in ${context}`);
    }
    return value;
}

/**
 * Returns a field as string if present, undefined otherwise. Throws if present but wrong type.
 */
function optionalString(record: Record<string, unknown>, field: string, context: string): string | undefined {
    const value = record[field];
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== "string") {
        throw new Error(`Invalid '${field}' (expected string) in ${context}`);
    }
    return value;
}

/**
 * Returns a field as string or number if present, undefined otherwise. Throws if present but wrong type.
 */
function optionalStringOrNumber(
    record: Record<string, unknown>, field: string, context: string,
): string | number | undefined {
    const value = record[field];
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== "string" && typeof value !== "number") {
        throw new Error(`Invalid '${field}' (expected string or number) in ${context}`);
    }
    return value;
}

function optionalBoolean(record: Record<string, unknown>, field: string, context: string): boolean | undefined {
    const value = record[field];
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== "boolean") {
        throw new Error(`Invalid '${field}' (expected boolean) in ${context}`);
    }
    return value;
}

function validateFalloutArg(data: unknown, context: string): FalloutArg {
    const r = assertObject(data, context);
    return {
        name: requireString(r, "name", context),
        type: requireString(r, "type", context),
        doc: requireString(r, "doc", context),
    };
}

export function validateSfallFunction(data: unknown, context: string): SfallFunction {
    const r = assertObject(data, context);

    const rawArgs = r["args"];
    let args: readonly FalloutArg[] | undefined;
    if (rawArgs !== undefined) {
        const arr = assertArray(rawArgs, `${context}.args`);
        args = arr.map((a, i) => validateFalloutArg(a, `${context}.args[${i}]`));
    }

    return {
        name: requireString(r, "name", context),
        detail: requireString(r, "detail", context),
        doc: optionalString(r, "doc", context),
        opcode: optionalStringOrNumber(r, "opcode", context),
        unsafe: optionalBoolean(r, "unsafe", context),
        macro: optionalString(r, "macro", context),
        args,
        type: optionalString(r, "type", context),
    };
}

export function validateSfallCategory(data: unknown, context: string): SfallCategory {
    const r = assertObject(data, context);

    const rawItems = r["items"];
    let items: readonly SfallFunction[] | undefined;
    if (rawItems !== undefined) {
        const arr = assertArray(rawItems, `${context}.items`);
        items = arr.map((item, i) => validateSfallFunction(item, `${context}.items[${i}]`));
    }

    return {
        name: requireString(r, "name", context),
        parent: optionalString(r, "parent", context),
        doc: optionalString(r, "doc", context),
        items,
    };
}

export function validateSfallHook(data: unknown, context: string): SfallHook {
    const r = assertObject(data, context);
    return {
        name: requireString(r, "name", context),
        id: optionalString(r, "id", context),
        doc: requireString(r, "doc", context),
        filename: optionalString(r, "filename", context),
    };
}

/**
 * Validates an array of items using the given item validator.
 * Provides indexed context for each element's error messages.
 */
export function validateArray<T>(
    data: unknown,
    itemValidator: (item: unknown, context: string) => T,
    context: string,
): readonly T[] {
    const arr = assertArray(data, context);
    return arr.map((item, i) => itemValidator(item, `${context}[${i}]`));
}
