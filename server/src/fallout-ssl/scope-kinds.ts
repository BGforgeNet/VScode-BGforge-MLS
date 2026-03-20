export const ScopeKind = {
    File: "file",
    Procedure: "procedure",
    External: "external",
} as const;

export type ScopeKind = typeof ScopeKind[keyof typeof ScopeKind];
