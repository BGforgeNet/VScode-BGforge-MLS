export type NumericFormat = "decimal" | "hex32";

export function resolveNumericFormat(format: string, fieldName: string): NumericFormat {
    if (format === "map" && (
        fieldName === "PID"
        || fieldName === "FID"
        || fieldName === "CID"
        || fieldName === "SID"
        || /^Entry \d+ SID$/.test(fieldName)
    )) {
        return "hex32";
    }

    return "decimal";
}

export function formatNumericValue(rawValue: number, numericFormat: NumericFormat): string {
    if (numericFormat === "hex32") {
        return `0x${(rawValue >>> 0).toString(16).toUpperCase()}`;
    }

    return String(rawValue);
}

export function formatEditableNumberValue(rawValue: number, numericFormat: NumericFormat): string {
    if (numericFormat === "hex32") {
        return (rawValue >>> 0).toString(16).toUpperCase();
    }

    return String(rawValue);
}

export function sanitizeEditableNumberValue(text: string, numericFormat: NumericFormat): string {
    if (numericFormat === "hex32") {
        return text.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
    }

    const trimmed = text.replace(/[^\d-]/g, "");
    if (trimmed.startsWith("-")) {
        return `-${trimmed.slice(1).replace(/-/g, "")}`;
    }
    return trimmed.replace(/-/g, "");
}

export function parseEditableNumberValue(text: string, numericFormat: NumericFormat): number {
    const sanitized = sanitizeEditableNumberValue(text.trim(), numericFormat);
    if (sanitized.length === 0 || sanitized === "-") {
        return Number.NaN;
    }

    if (numericFormat === "hex32") {
        const parsed = Number.parseInt(sanitized, 16);
        return parsed | 0;
    }

    return Number.parseInt(sanitized, 10);
}
