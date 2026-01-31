/**
 * Unit tests for TSSL diagnostic filtering.
 * Tests ENGINE_PROCEDURES set contents, TS6133 identifier extraction,
 * and filtering of engine procedure diagnostics.
 */

import { describe, expect, it } from "vitest";
import { ENGINE_PROCEDURES } from "../../server/src/tssl/engine-procedures";
import {
    type DiagnosticLike,
    extractIdentifierFromTS6133,
    filterEngineProcedureDiagnostics,
} from "../src/filter-diagnostics";

function makeDiagnostic(code: number, messageText: string | { readonly messageText: string }): DiagnosticLike {
    return { code, messageText };
}

describe("ENGINE_PROCEDURES", () => {
    it("contains 23 entries", () => {
        expect(ENGINE_PROCEDURES.size).toBe(23);
    });

    it("includes start", () => {
        expect(ENGINE_PROCEDURES.has("start")).toBe(true);
    });

    it("includes talk_p_proc", () => {
        expect(ENGINE_PROCEDURES.has("talk_p_proc")).toBe(true);
    });

    it("includes combat_p_proc", () => {
        expect(ENGINE_PROCEDURES.has("combat_p_proc")).toBe(true);
    });

    it("does not include arbitrary names", () => {
        expect(ENGINE_PROCEDURES.has("my_custom_func")).toBe(false);
    });

    it("is a ReadonlySet (immutable)", () => {
        // ReadonlySet lacks add/delete/clear at the type level;
        // at runtime it's a Set, so just verify it's a Set instance
        expect(ENGINE_PROCEDURES).toBeInstanceOf(Set);
    });
});

describe("extractIdentifierFromTS6133", () => {
    it("extracts identifier from string message", () => {
        expect(
            extractIdentifierFromTS6133("'start' is declared but its value is never read.")
        ).toBe("start");
    });

    it("extracts identifier from double-quoted message", () => {
        expect(
            extractIdentifierFromTS6133('"talk_p_proc" is declared but its value is never read.')
        ).toBe("talk_p_proc");
    });

    it("extracts identifier from DiagnosticMessageChain", () => {
        const chain = { messageText: "'combat_p_proc' is declared but its value is never read." };
        expect(extractIdentifierFromTS6133(chain)).toBe("combat_p_proc");
    });

    it("returns undefined for non-matching message", () => {
        expect(extractIdentifierFromTS6133("Some other error message")).toBeUndefined();
    });

    it("returns undefined for empty string", () => {
        expect(extractIdentifierFromTS6133("")).toBeUndefined();
    });

    it("returns undefined for empty chain", () => {
        expect(extractIdentifierFromTS6133({ messageText: "" })).toBeUndefined();
    });
});

describe("filterEngineProcedureDiagnostics", () => {
    it("suppresses TS6133 for engine procedures", () => {
        const diagnostics = [
            makeDiagnostic(6133, "'start' is declared but its value is never read."),
            makeDiagnostic(6133, "'talk_p_proc' is declared but its value is never read."),
        ];
        const result = filterEngineProcedureDiagnostics(diagnostics);
        expect(result).toHaveLength(0);
    });

    it("keeps TS6133 for non-engine identifiers", () => {
        const diagnostics = [
            makeDiagnostic(6133, "'myVar' is declared but its value is never read."),
        ];
        const result = filterEngineProcedureDiagnostics(diagnostics);
        expect(result).toHaveLength(1);
    });

    it("keeps non-6133 diagnostics unchanged", () => {
        const diagnostics = [
            makeDiagnostic(2304, "Cannot find name 'foo'."),
            makeDiagnostic(1005, "';' expected."),
        ];
        const result = filterEngineProcedureDiagnostics(diagnostics);
        expect(result).toHaveLength(2);
    });

    it("handles mixed diagnostics correctly", () => {
        const diagnostics = [
            makeDiagnostic(6133, "'start' is declared but its value is never read."),
            makeDiagnostic(2304, "Cannot find name 'foo'."),
            makeDiagnostic(6133, "'myVar' is declared but its value is never read."),
            makeDiagnostic(6133, "'create_p_proc' is declared but its value is never read."),
        ];
        const result = filterEngineProcedureDiagnostics(diagnostics);
        expect(result).toHaveLength(2);
        expect(result[0]?.code).toBe(2304);
        expect(result[1]?.code).toBe(6133);
        expect(result[1]?.messageText).toContain("myVar");
    });

    it("returns empty array for empty input", () => {
        const result = filterEngineProcedureDiagnostics([]);
        expect(result).toHaveLength(0);
    });

    it("returns new array (immutable)", () => {
        const diagnostics = [
            makeDiagnostic(2304, "Cannot find name 'foo'."),
        ];
        const result = filterEngineProcedureDiagnostics(diagnostics);
        expect(result).not.toBe(diagnostics);
    });
});
