import { FALLOUT_SSL_STANZAS } from "../../../../shared/stanza-names.ts";

/**
 * Type definitions for Fallout sfall data structures.
 * Used when parsing sfall's functions.yml and hooks.yml, and when
 * generating completion and highlight YAML files.
 */

/** A category of sfall functions as parsed from functions.yml */
export interface SfallCategory {
    readonly name: string;
    readonly parent?: string;
    readonly doc?: string;
    readonly items?: readonly SfallFunction[];
}

/** An individual sfall function within a category */
export interface SfallFunction {
    readonly name: string;
    readonly detail: string;
    readonly doc?: string;
    readonly opcode?: string | number;
    readonly unsafe?: boolean;
    readonly macro?: string;
    readonly args?: readonly FalloutArg[];
    readonly type?: string;
}

/** A hook entry from hooks.yml */
export interface SfallHook {
    readonly name: string;
    readonly id?: string;
    readonly doc: string;
    readonly filename?: string;
}

/** Classification of a #define extracted from header files */
export type DefineKind = "constant" | "variable" | "procedure" | "define_with_vars" | "alias";

/** Completion item for the sfall YAML output */
export interface FalloutCompletionItem {
    readonly name: string;
    readonly detail?: string;
    readonly doc?: string;
    readonly args?: readonly FalloutArg[];
    readonly type?: string;
}

/** A function argument */
export interface FalloutArg {
    readonly name: string;
    readonly type: string;
    readonly doc: string;
}

/** A highlight pattern entry for tmLanguage YAML */
export interface HighlightPattern {
    readonly match: string;
    readonly name?: string;
}

/** Named-argument payload for selective tmLanguage stanza updates. */
export interface FalloutHighlightDumpInput {
    readonly baseFunctionPatterns?: readonly HighlightPattern[];
    readonly sfallFunctionPatterns?: readonly HighlightPattern[];
    readonly hookPatterns?: readonly HighlightPattern[];
    readonly headerDefines?: ReadonlyMap<string, DefineKind>;
}

/** Completion type constants matching the LSP extension's type enum */
export const COMPLETION_TYPE_FUNCTION = 3;
export const COMPLETION_TYPE_CONSTANT = 21;

/** Stanza names in the completion YAML */
export const SFALL_FUNCTIONS_STANZA = FALLOUT_SSL_STANZAS.sfall_functions;
export const SFALL_HOOKS_STANZA = FALLOUT_SSL_STANZAS.hooks;

/** Repository stanza names in the highlight YAML */
export const HIGHLIGHT_STANZAS = {
    falloutBaseFunctions: "fallout-base-functions",
    sfallFunctions: FALLOUT_SSL_STANZAS.sfall_functions,
    hooks: FALLOUT_SSL_STANZAS.hooks,
    headerConstants: "header-constants",
    headerVariables: "header-variables",
    headerProcedures: "header-procedures",
    headerDefinesWithVars: "header-defines-with-vars",
    headerAliases: "header-aliases",
} as const;

export const GENERATED_FALLOUT_BASE_FUNCTIONS_COMMENT =
    " This stanza is generated from server/data/fallout-ssl-base.yml.\n Do not edit manually.";
