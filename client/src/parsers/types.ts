/**
 * Represents a parsed field in a binary structure
 */
export interface ParsedField {
    name: string;
    value: unknown;
    /** Raw value before any transformation */
    rawValue?: number | string;
    /** Offset in bytes from start of file */
    offset: number;
    /** Size in bytes */
    size: number;
    /** Human-readable type description */
    type: string;
    /** Optional description of the field */
    description?: string;
}

/**
 * Represents a group of related fields
 */
export interface ParsedGroup {
    name: string;
    /** Optional description of the group */
    description?: string;
    fields: (ParsedField | ParsedGroup)[];
    /** Whether this group is expanded by default */
    expanded?: boolean;
}

/**
 * Result of parsing a binary file
 */
export interface ParseResult {
    /** Format identifier (e.g., "pro", "frm", "map") */
    format: string;
    /** Human-readable format name */
    formatName: string;
    /** Parsed structure as groups and fields */
    root: ParsedGroup;
    /** Any warnings during parsing */
    warnings?: string[];
    /** Any errors during parsing */
    errors?: string[];
}

/**
 * Interface for binary file parsers
 */
export interface BinaryParser {
    /** Unique identifier for this parser */
    readonly id: string;
    /** Human-readable name */
    readonly name: string;
    /** File extensions this parser handles (without dot) */
    readonly extensions: string[];
    /** Parse binary data and return structured result */
    parse(data: Uint8Array): ParseResult;
}
