/**
 * Validates that JSDoc type lists in TextMate grammars stay in sync
 * with the canonical type lists in jsdoc-types.ts.
 *
 * Catches drift when types are added/removed in one place but not the others.
 */

import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
    ALL_JSDOC_TYPE_NAMES,
    CUSTOM_JSDOC_TYPE_NAMES,
    FALLOUT_JSDOC_TYPE_NAMES,
    WEIDU_JSDOC_TYPE_NAMES,
} from "../../src/shared/jsdoc-types";
import { WEIDU_JSDOC_TYPES } from "../../src/shared/weidu-types";

const SYNTAXES_DIR = path.resolve(__dirname, "../../../syntaxes");

/** Extract type names from a regex alternation like \b(array|bool|int)\b in YAML content. */
function extractTypesFromRegex(content: string, pattern: RegExp): string[] {
    const types = new Set<string>();
    let match;
    const globalPattern = new RegExp(pattern.source, "g");
    while ((match = globalPattern.exec(content)) !== null) {
        const alternation = match[1];
        for (const type of alternation.split("|")) {
            types.add(type.trim());
        }
    }
    return [...types].sort();
}

describe("JSDoc type sync", () => {
    describe("docstring grammar matches canonical list", () => {
        const content = readFileSync(
            path.join(SYNTAXES_DIR, "bgforge-mls-docstring.tmLanguage.yml"),
            "utf-8",
        );

        it("type repository contains exactly ALL_JSDOC_TYPE_NAMES", () => {
            // The #type repository has a single regex: \b(array|any|...|string)\b
            const typeRepoTypes = extractTypesFromRegex(
                content,
                /- match: \\b\(([^)]+)\)\\b/m,
            );
            expect(typeRepoTypes).toEqual([...ALL_JSDOC_TYPE_NAMES].sort());
        });

        it("brace-less param pattern contains exactly ALL_JSDOC_TYPE_NAMES", () => {
            // The brace-less @param pattern has types in a regex alternation
            const paramLine = content
                .split("\n")
                .find((l) => l.includes("@arg|@param)\\s+(") && !l.includes("{"));
            expect(paramLine).toBeDefined();
            const match = paramLine!.match(/\(([^)]+)\)\\s\+\(\\w\+\)/);
            expect(match).toBeTruthy();
            const types = match![1].split("|").sort();
            expect(types).toEqual([...ALL_JSDOC_TYPE_NAMES].sort());
        });

        it("brace-less unnamed ret pattern contains exactly ALL_JSDOC_TYPE_NAMES", () => {
            const retLine = content
                .split("\n")
                .find(
                    (l) =>
                        l.includes("@ret|@return|@returns)\\s+(") &&
                        !l.includes("{") &&
                        !l.includes("\\w+)\\s+("),
                );
            expect(retLine).toBeDefined();
            const match = retLine!.match(
                /\(@ret\|@return\|@returns\)\\s\+\(([^)]+)\)\\b/,
            );
            expect(match).toBeTruthy();
            const types = match![1].split("|").sort();
            expect(types).toEqual([...ALL_JSDOC_TYPE_NAMES].sort());
        });
    });

    describe("weidu-types.ts keys match WEIDU_JSDOC_TYPE_NAMES", () => {
        it("WEIDU_JSDOC_TYPES map keys equal WEIDU_JSDOC_TYPE_NAMES", () => {
            const mapKeys = [...WEIDU_JSDOC_TYPES.keys()].sort();
            expect(mapKeys).toEqual([...WEIDU_JSDOC_TYPE_NAMES].sort());
        });
    });

    describe("canonical lists are consistent", () => {
        it("custom types are a subset of ALL_JSDOC_TYPE_NAMES", () => {
            for (const type of CUSTOM_JSDOC_TYPE_NAMES) {
                expect(ALL_JSDOC_TYPE_NAMES).toContain(type);
            }
        });

        it("fallout types are a subset of ALL_JSDOC_TYPE_NAMES", () => {
            for (const type of FALLOUT_JSDOC_TYPE_NAMES) {
                expect(ALL_JSDOC_TYPE_NAMES).toContain(type);
            }
        });

        it("weidu types are a subset of ALL_JSDOC_TYPE_NAMES", () => {
            for (const type of WEIDU_JSDOC_TYPE_NAMES) {
                expect(ALL_JSDOC_TYPE_NAMES).toContain(type);
            }
        });

        it("ALL_JSDOC_TYPE_NAMES has no duplicates", () => {
            const unique = new Set(ALL_JSDOC_TYPE_NAMES);
            expect(unique.size).toBe(ALL_JSDOC_TYPE_NAMES.length);
        });

        it("ALL_JSDOC_TYPE_NAMES is sorted", () => {
            const sorted = [...ALL_JSDOC_TYPE_NAMES].sort();
            expect(ALL_JSDOC_TYPE_NAMES).toEqual(sorted);
        });
    });
});
