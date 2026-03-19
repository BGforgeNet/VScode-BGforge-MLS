import {
    SemanticTokenTypes,
    SemanticTokens,
    SemanticTokensBuilder,
    SemanticTokensLegend,
} from "vscode-languageserver/node";

export interface SemanticTokenSpan {
    readonly line: number;
    readonly startChar: number;
    readonly length: number;
    readonly tokenType: string;
    readonly tokenModifiers: number;
}

export const semanticTokensLegend: SemanticTokensLegend = {
    tokenTypes: [SemanticTokenTypes.parameter],
    tokenModifiers: [],
};

const tokenTypeToIndex = new Map(
    semanticTokensLegend.tokenTypes.map((tokenType, index) => [tokenType, index] as const)
);

function compareSpans(left: SemanticTokenSpan, right: SemanticTokenSpan): number {
    if (left.line !== right.line) {
        return left.line - right.line;
    }
    if (left.startChar !== right.startChar) {
        return left.startChar - right.startChar;
    }
    if (left.length !== right.length) {
        return left.length - right.length;
    }
    return left.tokenType.localeCompare(right.tokenType);
}

export function encodeSemanticTokens(spans: readonly SemanticTokenSpan[]): SemanticTokens {
    if (spans.length === 0) {
        return { data: [] };
    }

    const builder = new SemanticTokensBuilder();
    const sorted = [...spans].sort(compareSpans);

    for (const span of sorted) {
        const tokenTypeIndex = tokenTypeToIndex.get(span.tokenType);
        if (tokenTypeIndex === undefined || span.length <= 0) {
            continue;
        }
        builder.push(span.line, span.startChar, span.length, tokenTypeIndex, span.tokenModifiers);
    }

    const built = builder.build();
    return { data: built.data };
}
