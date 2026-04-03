/**
 * Validation functions for binary editor field values.
 * Returns an error message string if invalid, undefined if valid.
 */

/** Numeric range limits by type name */
const RANGES: Record<string, [min: number, max: number]> = {
    uint8: [0, 0xFF],
    uint16: [0, 0xFFFF],
    uint24: [0, 0xFFFFFF],
    uint32: [0, 0xFFFFFFFF],
    int8: [-128, 127],
    int16: [-32768, 32767],
    int24: [-8388608, 8388607],
    int32: [-2147483648, 2147483647],
};

/**
 * Validate that a numeric value is within the range for its type.
 * Returns an error message if invalid, undefined if valid.
 */
export function validateNumericRange(value: number, type: string): string | undefined {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
        return `Value must be an integer, got ${value}`;
    }

    const range = RANGES[type];
    if (!range) return undefined;

    const [min, max] = range;
    if (value < min || value > max) {
        return `Value ${value} out of range for ${type} (${min} to ${max})`;
    }

    return undefined;
}

/**
 * Validate that a value is a valid enum member.
 * Returns an error message if invalid, undefined if valid.
 */
export function validateEnum(value: number, lookup: Record<number, string>): string | undefined {
    if (lookup[value] === undefined) {
        const valid = Object.keys(lookup).join(", ");
        return `Invalid value ${value}. Valid: ${valid}`;
    }
    return undefined;
}

/**
 * Validate that only known flag bits are set.
 * Returns an error message if invalid bits are set, undefined if valid.
 */
export function validateFlags(value: number, flagDefs: Record<number, string>): string | undefined {
    // Build a mask of all valid bits (skip 0 key which means "no flags")
    let validMask = 0;
    for (const bit of Object.keys(flagDefs)) {
        const n = Number(bit);
        if (n !== 0) validMask |= n;
    }

    const invalidBits = value & ~validMask;
    if (invalidBits !== 0) {
        return `Invalid flag bits: 0x${invalidBits.toString(16)}`;
    }
    return undefined;
}

export function validateFieldEdit(
    value: number,
    type: string,
    enumLookup?: Record<number, string>,
    flagDefs?: Record<number, string>,
): string | undefined {
    if (type === "enum") {
        return enumLookup ? validateEnum(value, enumLookup) : undefined;
    }

    if (type === "flags") {
        return flagDefs ? validateFlags(value, flagDefs) : undefined;
    }

    if (type.includes("int") || type.includes("uint")) {
        return validateNumericRange(value, type);
    }

    return undefined;
}
