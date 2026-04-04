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
    /** Raw byte ranges preserved when parts of the format cannot be decoded structurally */
    opaqueRanges?: ParseOpaqueRange[];
    /** Any warnings during parsing */
    warnings?: string[];
    /** Any errors during parsing */
    errors?: string[];
}

/**
 * Raw byte range preserved in JSON for undecoded sections.
 * Bytes are chunked into short hex strings to keep diffs readable.
 */
export interface ParseOpaqueRange {
    label: string;
    offset: number;
    size: number;
    hexChunks: string[];
}

export interface ParseOptions {
    /**
     * Allow MAP files with ambiguous script/object boundaries to fall back to an
     * opaque object section instead of reporting a parse error.
     */
    gracefulMapBoundaries?: boolean;
    /**
     * Skip materializing MAP tile fields while still preserving the underlying
     * bytes for round-trip serialization.
     */
    skipMapTiles?: boolean;
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
    parse(data: Uint8Array, options?: ParseOptions): ParseResult;
    /** Serialize structured result back to binary data (optional, for editors) */
    serialize?(result: ParseResult): Uint8Array;
}
