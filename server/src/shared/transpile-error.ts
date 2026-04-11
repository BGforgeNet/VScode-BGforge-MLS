/**
 * Structured error type for transpiler failures, carrying source location.
 * Replaces bare Error throws across TSSL, TBAF, and TD transpilers so callers
 * can surface file:line information in diagnostics and CLI output.
 */

interface TranspileErrorLocation {
    readonly file?: string;
    readonly line?: number;
    readonly column?: number;
}

export class TranspileError extends Error {
    readonly location: TranspileErrorLocation;

    constructor(message: string, location: TranspileErrorLocation = {}, cause?: unknown) {
        super(message);
        this.name = "TranspileError";
        this.location = location;
        if (cause !== undefined) {
            // `cause` is part of the Error standard (ES2022) but older TS lib
            // typings may not include it; set it manually for cross-runtime compat.
            (this as unknown as Record<string, unknown>)["cause"] = cause;
        }
    }

    /** Build a TranspileError from a ts-morph Node, reading line from it. */
    static fromNode(node: { getStartLineNumber(): number }, message: string, filePath?: string): TranspileError {
        return new TranspileError(message, { file: filePath, line: node.getStartLineNumber() });
    }

    /** Wrap an unknown thrown value as a TranspileError, filling in missing location fields. */
    static wrap(err: unknown, location: TranspileErrorLocation): TranspileError {
        if (err instanceof TranspileError) {
            // Fill in only fields that are missing from the inner error
            const merged: TranspileErrorLocation = {
                file: err.location.file ?? location.file,
                line: err.location.line ?? location.line,
                column: err.location.column ?? location.column,
            };
            return new TranspileError(err.message, merged, err);
        }
        const message = err instanceof Error ? err.message : String(err);
        return new TranspileError(message, location, err);
    }
}
