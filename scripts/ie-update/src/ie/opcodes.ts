/**
 * Opcode name normalization for IESDP opcode processing.
 * Converts human-readable opcode names to valid identifier strings.
 */

/** Character replacements applied in order to normalize opcode names */
const REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
    [" ", "_"],
    [")", "_"],
    ["(", "_"],
    [":", ""],
    ["-", "_"],
    [",", ""],
    ["&", ""],
    [".", ""],
    ["'", ""],
    ["/", "_"],
    ["modifier", "mod"],
    ["resistance", "resist"],
    ["removal_remove", "remove"],
    ["high_level_ability", "HLA"],
    ["____", "_"],
    ["___", "_"],
    ["__", "_"],
];

/** Prefixes stripped from the left side of normalized names */
const LEFT_STRIP: readonly string[] = [
    "item_",
    "graphics_",
    "spell_effect_", // must be before spell_
    "spell_",
    "stat_",
    "state_",
    "summon_",
];

/**
 * Converts a human-readable opcode name to a normalized identifier.
 * Applies character replacements, deduplicates underscores, and strips known prefixes.
 */
export function opcodeNameToId(name: string): string {
    let result = name.toLowerCase();

    for (const [orig, repl] of REPLACEMENTS) {
        result = result.replaceAll(orig, repl);
    }

    // Intentional extra pass for underscores that may remain after replacements
    result = result.replaceAll("__", "_");
    result = result.replace(/^_+/, "").replace(/_+$/, "");

    for (const prefix of LEFT_STRIP) {
        if (result.startsWith(prefix)) {
            result = result.slice(prefix.length);
            break;
        }
    }

    return result;
}
