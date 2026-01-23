/**
 * Unit tests for WeiDU TP2 function call snippet generation.
 * Tests auto-completion with required parameters for LAF/LPF.
 */

import { describe, expect, it } from "vitest";
import { buildFunctionCallSnippet } from "../src/weidu-tp2/provider";
import { parse as parseJSDoc } from "../src/shared/jsdoc";
import type { FunctionInfo } from "../src/weidu-tp2/header-parser";
import { Location } from "vscode-languageserver/node";

// Helper to create a minimal FunctionInfo for testing
function createFunctionInfo(
    name: string,
    intVarParams: Array<{ name: string; defaultValue?: string }>,
    strVarParams: Array<{ name: string; defaultValue?: string }>,
    jsdocText?: string
): FunctionInfo {
    const location: Location = {
        uri: "file:///test.tph",
        range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 },
        },
    };

    const funcInfo: FunctionInfo = {
        name,
        context: "action",
        dtype: "function",
        location,
        params: {
            intVar: intVarParams,
            strVar: strVarParams,
            ret: [],
            retArray: [],
        },
    };

    if (jsdocText) {
        funcInfo.jsdoc = parseJSDoc(jsdocText);
    }

    return funcInfo;
}

describe("weidu-tp2: function call snippet generation", () => {
    it("returns null when no required params exist", () => {
        const funcInfo = createFunctionInfo(
            "my_func",
            [{ name: "x", defaultValue: "0" }],
            [{ name: "y", defaultValue: '""' }]
        );

        const snippet = buildFunctionCallSnippet(funcInfo);
        expect(snippet).toBeNull();
    });

    it("returns null for functions without params (macros)", () => {
        const funcInfo: FunctionInfo = {
            name: "my_macro",
            context: "action",
            dtype: "macro",
            location: {
                uri: "file:///test.tph",
                range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 0 },
                },
            },
        };

        const snippet = buildFunctionCallSnippet(funcInfo);
        expect(snippet).toBeNull();
    });

    it("generates snippet for only required INT_VAR params", () => {
        const jsdoc = `/**
 * Test function
 * @param {int} x! - required x param
 * @param {int} y - optional y param
 */`;
        const funcInfo = createFunctionInfo(
            "my_func",
            [
                { name: "x", defaultValue: "0" },
                { name: "y", defaultValue: "1" },
            ],
            [],
            jsdoc
        );

        const snippet = buildFunctionCallSnippet(funcInfo);
        expect(snippet).toBe(
            "my_func\n    INT_VAR\n        x = $1\nEND$0"
        );
    });

    it("generates snippet for only required STR_VAR params", () => {
        const jsdoc = `/**
 * Test function
 * @param {string} name! - required name
 */`;
        const funcInfo = createFunctionInfo(
            "my_func",
            [],
            [{ name: "name", defaultValue: '""' }],
            jsdoc
        );

        const snippet = buildFunctionCallSnippet(funcInfo);
        expect(snippet).toBe(
            'my_func\n    STR_VAR\n        name = $1\nEND$0'
        );
    });

    it("generates snippet for both required INT_VAR and STR_VAR params", () => {
        const jsdoc = `/**
 * Test function
 * @param {int} x! - required x
 * @param {int} y! - required y
 * @param {string} z! - required z
 */`;
        const funcInfo = createFunctionInfo(
            "my_func",
            [
                { name: "x", defaultValue: "0" },
                { name: "y", defaultValue: "0" },
            ],
            [{ name: "z", defaultValue: '""' }],
            jsdoc
        );

        const snippet = buildFunctionCallSnippet(funcInfo);
        expect(snippet).toBe(
            'my_func\n    INT_VAR\n        x = $1\n        y = $2\n    STR_VAR\n        z = $3\nEND$0'
        );
    });

    it("excludes optional params from snippet", () => {
        const jsdoc = `/**
 * Test function
 * @param {int} required_param! - required
 * @param {int} optional_param - optional
 * @param {string} another_required! - required
 * @param {string} another_optional - optional
 */`;
        const funcInfo = createFunctionInfo(
            "my_func",
            [
                { name: "required_param", defaultValue: "0" },
                { name: "optional_param", defaultValue: "0" },
            ],
            [
                { name: "another_required", defaultValue: '""' },
                { name: "another_optional", defaultValue: '""' },
            ],
            jsdoc
        );

        const snippet = buildFunctionCallSnippet(funcInfo);
        expect(snippet).toBe(
            'my_func\n    INT_VAR\n        required_param = $1\n    STR_VAR\n        another_required = $2\nEND$0'
        );
    });

    it("generates correct tab stops in sequence", () => {
        const jsdoc = `/**
 * @param {int} a!
 * @param {int} b!
 * @param {int} c!
 */`;
        const funcInfo = createFunctionInfo(
            "test",
            [
                { name: "a", defaultValue: "0" },
                { name: "b", defaultValue: "0" },
                { name: "c", defaultValue: "0" },
            ],
            [],
            jsdoc
        );

        const snippet = buildFunctionCallSnippet(funcInfo);
        expect(snippet).toContain("$1");
        expect(snippet).toContain("$2");
        expect(snippet).toContain("$3");
        expect(snippet).toContain("END$0");
    });

    it("generates snippet with LAF prefix when provided", () => {
        const jsdoc = `/**
 * @param {int} x! - required param
 */`;
        const funcInfo = createFunctionInfo(
            "my_func",
            [{ name: "x", defaultValue: "0" }],
            [],
            jsdoc
        );

        const snippet = buildFunctionCallSnippet(funcInfo, "LAF");
        expect(snippet).toBe(
            "LAF my_func\n    INT_VAR\n        x = $1\nEND$0"
        );
    });

    it("generates snippet with LPF prefix when provided", () => {
        const jsdoc = `/**
 * @param {string} name! - required name
 */`;
        const funcInfo = createFunctionInfo(
            "my_func",
            [],
            [{ name: "name", defaultValue: '""' }],
            jsdoc
        );

        const snippet = buildFunctionCallSnippet(funcInfo, "LPF");
        expect(snippet).toBe(
            'LPF my_func\n    STR_VAR\n        name = $1\nEND$0'
        );
    });

    it("generates snippet with prefix for both INT_VAR and STR_VAR params", () => {
        const jsdoc = `/**
 * @param {int} x! - required x
 * @param {string} name! - required name
 */`;
        const funcInfo = createFunctionInfo(
            "complex_func",
            [{ name: "x", defaultValue: "0" }],
            [{ name: "name", defaultValue: '""' }],
            jsdoc
        );

        const snippet = buildFunctionCallSnippet(funcInfo, "LAF");
        expect(snippet).toBe(
            'LAF complex_func\n    INT_VAR\n        x = $1\n    STR_VAR\n        name = $2\nEND$0'
        );
    });

    it("generates snippet without prefix when not provided", () => {
        const jsdoc = `/**
 * @param {int} x! - required param
 */`;
        const funcInfo = createFunctionInfo(
            "my_func",
            [{ name: "x", defaultValue: "0" }],
            [],
            jsdoc
        );

        const snippet = buildFunctionCallSnippet(funcInfo);
        expect(snippet).toBe(
            "my_func\n    INT_VAR\n        x = $1\nEND$0"
        );
        expect(snippet).not.toContain("LAF");
        expect(snippet).not.toContain("LPF");
    });
});
