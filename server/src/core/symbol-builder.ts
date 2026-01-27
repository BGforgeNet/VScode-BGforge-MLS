/**
 * Symbol builder - transforms raw symbol data into IndexedSymbol objects with pre-computed LSP data.
 *
 * This module provides a single buildSymbol() function that takes raw parsed data
 * and produces a complete IndexedSymbol with pre-computed completion, hover, and signature
 * fields ready for immediate LSP responses.
 *
 * Design principles:
 * - Single source of truth: All LSP data derived from one input
 * - Consistency: Completion, hover, and signature always match
 * - Pre-computation: No per-request computation needed
 * - Type safety: Returns proper discriminated union type based on kind
 */

import {
    type CompletionItem,
    type Hover,
    MarkupKind,
    type ParameterInformation,
    type SignatureInformation,
} from "vscode-languageserver/node";
import {
    type IndexedSymbol,
    type CallableSymbol,
    type VariableSymbol,
    type ConstantSymbol,
    type StateSymbol,
    type ComponentSymbol,
    type SymbolLocation,
    type SymbolScope,
    type SymbolSource,
    type CallableInfo,
    type VariableInfoData,
    SymbolKind,
    symbolKindToCompletionKind,
} from "./symbol";

// =============================================================================
// Input Types
// =============================================================================

/**
 * Parameter information for callable symbols.
 */
export interface ParameterData {
    /** Parameter name */
    readonly name: string;

    /** Parameter type (e.g., "INT_VAR", "STR_VAR", "O:Object") */
    readonly type?: string;

    /** Parameter description from JSDoc */
    readonly description?: string;

    /** Default value if any */
    readonly defaultValue?: string;
}

/**
 * Raw symbol data as input to buildSymbol().
 * Contains all information needed to construct a complete IndexedSymbol.
 */
export interface RawSymbolData {
    /** Symbol name */
    readonly name: string;

    /** Symbol kind */
    readonly kind: SymbolKind;

    /** Location in source code */
    readonly location: SymbolLocation;

    /** Scope information */
    readonly scope: SymbolScope;

    /** Source information (type and uri) */
    readonly source: Omit<SymbolSource, "displayPath">;

    /** Parameters for callable symbols (functions, procedures, macros) */
    readonly parameters?: readonly ParameterData[];

    /** Description from JSDoc or data file */
    readonly description?: string;

    /** Return type for functions */
    readonly returnType?: string;

    /** Type for variables (e.g., from @type JSDoc tag) */
    readonly type?: string;

    /** Value for constants/variables */
    readonly value?: string;

    /** Display path for UI (relative path for workspace symbols) */
    readonly displayPath?: string;

    /** Context for callables (action/patch) */
    readonly context?: "action" | "patch";

    /** Definition type for callables (function/macro) */
    readonly dtype?: "function" | "macro";
}

// =============================================================================
// Builder
// =============================================================================

/**
 * Build a complete IndexedSymbol from raw data.
 *
 * Pre-computes all LSP responses (completion, hover, signature) to ensure
 * consistency and fast query performance. Returns the appropriate discriminated
 * union type based on the symbol kind.
 */
export function buildSymbol(raw: RawSymbolData): IndexedSymbol {
    const source: SymbolSource = {
        type: raw.source.type,
        uri: raw.source.uri,
        displayPath: raw.displayPath,
    };

    const base = {
        name: raw.name,
        location: raw.location,
        scope: raw.scope,
        source,
        completion: buildCompletion(raw),
        hover: buildHover(raw),
        signature: buildSignature(raw),
    };

    // Return proper discriminated union type based on kind
    if (isCallableKind(raw.kind)) {
        return {
            ...base,
            kind: raw.kind,
            callable: buildCallableInfo(raw),
        } as CallableSymbol;
    }

    if (isVariableKind(raw.kind)) {
        return {
            ...base,
            kind: raw.kind,
            variable: buildVariableInfo(raw),
        } as VariableSymbol;
    }

    if (raw.kind === SymbolKind.Constant) {
        return {
            ...base,
            kind: raw.kind,
            constant: {
                value: raw.value ?? "",
                type: raw.type,
            },
        } as ConstantSymbol;
    }

    if (raw.kind === SymbolKind.State) {
        return {
            ...base,
            kind: raw.kind,
        } as StateSymbol;
    }

    // Only remaining kind after Callable, Variable, Constant, State checks is Component
    return {
        ...base,
        kind: raw.kind as SymbolKind.Component,
    } as ComponentSymbol;
}

// =============================================================================
// Kind Helpers
// =============================================================================

const CALLABLE_KINDS = new Set([
    SymbolKind.Function,
    SymbolKind.Procedure,
    SymbolKind.Macro,
    SymbolKind.Action,
    SymbolKind.Trigger,
]);

const VARIABLE_KINDS = new Set([
    SymbolKind.Variable,
    SymbolKind.Parameter,
    SymbolKind.LoopVariable,
]);

function isCallableKind(kind: SymbolKind): kind is SymbolKind.Function | SymbolKind.Procedure | SymbolKind.Macro | SymbolKind.Action | SymbolKind.Trigger {
    return CALLABLE_KINDS.has(kind);
}

function isVariableKind(kind: SymbolKind): kind is SymbolKind.Variable | SymbolKind.Parameter | SymbolKind.LoopVariable {
    return VARIABLE_KINDS.has(kind);
}

// =============================================================================
// Info Builders
// =============================================================================

function buildCallableInfo(raw: RawSymbolData): CallableInfo {
    const params = raw.parameters ?? [];

    return {
        description: raw.description,
        returnType: raw.returnType,
        context: raw.context,
        dtype: raw.dtype,
        parameters: params.map(p => ({
            name: p.name,
            type: p.type,
            description: p.description,
            defaultValue: p.defaultValue,
        })),
    };
}

function buildVariableInfo(raw: RawSymbolData): VariableInfoData {
    return {
        type: raw.type ?? "unknown",
        value: raw.value,
        description: raw.description,
    };
}

// =============================================================================
// Completion Builder
// =============================================================================

function buildCompletion(raw: RawSymbolData): CompletionItem {
    const item: CompletionItem = {
        label: raw.name,
        kind: symbolKindToCompletionKind(raw.kind),
    };

    // Add detail for callables (shows signature)
    if (isCallableKind(raw.kind) && raw.parameters !== undefined) {
        item.detail = buildSignatureLabel(raw);
    }

    // Add labelDetails with displayPath for workspace/header symbols
    if (raw.displayPath) {
        item.labelDetails = {
            description: raw.displayPath,
        };
    }

    return item;
}

// =============================================================================
// Hover Builder
// =============================================================================

function buildHover(raw: RawSymbolData): Hover {
    const lines: string[] = [];

    // First line: signature in code block
    const signature = buildSignatureLabel(raw);
    lines.push("```");
    lines.push(signature);
    lines.push("```");

    // Add description if present
    if (raw.description) {
        lines.push("");
        lines.push(raw.description);
    }

    // Add parameter documentation for callables
    if (isCallableKind(raw.kind) && raw.parameters && raw.parameters.length > 0) {
        const paramDocs = raw.parameters
            .filter(p => p.description)
            .map(p => `- \`${p.name}\`: ${p.description}`);

        if (paramDocs.length > 0) {
            lines.push("");
            lines.push("**Parameters:**");
            lines.push(...paramDocs);
        }
    }

    // Add source location for workspace symbols
    if (raw.displayPath) {
        lines.push("");
        lines.push(`*from ${raw.displayPath}*`);
    }

    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: lines.join("\n"),
        },
    };
}

// =============================================================================
// Signature Builder
// =============================================================================

function buildSignature(raw: RawSymbolData): SignatureInformation | undefined {
    // Only callables with parameters get signature help
    if (!isCallableKind(raw.kind)) {
        return undefined;
    }

    // Constant-like macros (no parameters) don't need signature help
    if (raw.kind === SymbolKind.Macro && (!raw.parameters || raw.parameters.length === 0)) {
        return undefined;
    }

    const params = raw.parameters ?? [];

    const parameters: ParameterInformation[] = params.map(p => {
        const paramInfo: ParameterInformation = {
            label: p.type ? `${p.type} ${p.name}` : p.name,
        };
        if (p.description) {
            paramInfo.documentation = p.description;
        }
        return paramInfo;
    });

    const sig: SignatureInformation = {
        label: buildSignatureLabel(raw),
        parameters,
    };

    if (raw.description) {
        sig.documentation = raw.description;
    }

    return sig;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Build a signature label string like "func(INT_VAR x, STR_VAR y)".
 */
function buildSignatureLabel(raw: RawSymbolData): string {
    // For non-callables, just return the name with optional type
    if (!isCallableKind(raw.kind)) {
        if (raw.type) {
            return `${raw.type} ${raw.name}`;
        }
        return raw.name;
    }

    // Build parameter list with default values: "int x = 0"
    const params = raw.parameters ?? [];
    const paramStr = params
        .map(p => {
            const base = p.type ? `${p.type} ${p.name}` : p.name;
            return p.defaultValue ? `${base} = ${p.defaultValue}` : base;
        })
        .join(", ");

    let label = `${raw.name}(${paramStr})`;

    // Add return type prefix if present
    if (raw.returnType) {
        label = `${raw.returnType} ${label}`;
    }

    return label;
}
