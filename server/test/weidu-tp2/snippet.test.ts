/**
 * Unit tests for WeiDU TP2 function call snippet generation.
 * Tests auto-completion with required parameters for LAF/LPF.
 */

import { describe, expect, it } from "vitest";
import { buildFunctionCallSnippet } from "../../src/weidu-tp2/snippets";
import type { CallableInfo, CallableParam } from "../../src/core/symbol";

// Helper to create a minimal CallableInfo for testing
function createCallableInfo(
    intVarParams: CallableParam[],
    strVarParams: CallableParam[]
): CallableInfo {
    return {
        context: "action",
        dtype: "function",
        params: {
            intVar: intVarParams,
            strVar: strVarParams,
            ret: [],
            retArray: [],
        },
    };
}

describe("weidu-tp2: function call snippet generation", () => {
    it("returns null when no required params exist", () => {
        const callable = createCallableInfo(
            [{ name: "x", type: "int", defaultValue: "0" }],
            [{ name: "y", type: "string", defaultValue: '""' }]
        );

        const snippet = buildFunctionCallSnippet(callable, "my_func");
        expect(snippet).toBeNull();
    });

    it("returns null for functions without params (macros)", () => {
        const callable: CallableInfo = {
            context: "action",
            dtype: "macro",
        };

        const snippet = buildFunctionCallSnippet(callable, "my_macro");
        expect(snippet).toBeNull();
    });

    it("generates snippet for only required INT_VAR params", () => {
        const callable = createCallableInfo(
            [
                { name: "x", type: "int", defaultValue: "0", required: true },
                { name: "y", type: "int", defaultValue: "1" },
            ],
            []
        );

        const snippet = buildFunctionCallSnippet(callable, "my_func");
        expect(snippet).toBe(
            "my_func\n    INT_VAR\n        x = $1\nEND$0"
        );
    });

    it("generates snippet for only required STR_VAR params", () => {
        const callable = createCallableInfo(
            [],
            [{ name: "name", type: "string", defaultValue: '""', required: true }]
        );

        const snippet = buildFunctionCallSnippet(callable, "my_func");
        expect(snippet).toBe(
            'my_func\n    STR_VAR\n        name = $1\nEND$0'
        );
    });

    it("generates snippet for both required INT_VAR and STR_VAR params", () => {
        const callable = createCallableInfo(
            [
                { name: "x", type: "int", defaultValue: "0", required: true },
                { name: "y", type: "int", defaultValue: "0", required: true },
            ],
            [{ name: "z", type: "string", defaultValue: '""', required: true }]
        );

        const snippet = buildFunctionCallSnippet(callable, "my_func");
        expect(snippet).toBe(
            'my_func\n    INT_VAR\n        x = $1\n        y = $2\n    STR_VAR\n        z = $3\nEND$0'
        );
    });

    it("excludes optional params from snippet", () => {
        const callable = createCallableInfo(
            [
                { name: "required_param", type: "int", defaultValue: "0", required: true },
                { name: "optional_param", type: "int", defaultValue: "0" },
            ],
            [
                { name: "another_required", type: "string", defaultValue: '""', required: true },
                { name: "another_optional", type: "string", defaultValue: '""' },
            ]
        );

        const snippet = buildFunctionCallSnippet(callable, "my_func");
        expect(snippet).toBe(
            'my_func\n    INT_VAR\n        required_param = $1\n    STR_VAR\n        another_required = $2\nEND$0'
        );
    });

    it("generates correct tab stops in sequence", () => {
        const callable = createCallableInfo(
            [
                { name: "a", type: "int", defaultValue: "0", required: true },
                { name: "b", type: "int", defaultValue: "0", required: true },
                { name: "c", type: "int", defaultValue: "0", required: true },
            ],
            []
        );

        const snippet = buildFunctionCallSnippet(callable, "test");
        expect(snippet).toContain("$1");
        expect(snippet).toContain("$2");
        expect(snippet).toContain("$3");
        expect(snippet).toContain("END$0");
    });

    it("generates snippet with LAF prefix when provided", () => {
        const callable = createCallableInfo(
            [{ name: "x", type: "int", defaultValue: "0", required: true }],
            []
        );

        const snippet = buildFunctionCallSnippet(callable, "my_func", "LAF");
        expect(snippet).toBe(
            "LAF my_func\n    INT_VAR\n        x = $1\nEND$0"
        );
    });

    it("generates snippet with LPF prefix when provided", () => {
        const callable = createCallableInfo(
            [],
            [{ name: "name", type: "string", defaultValue: '""', required: true }]
        );

        const snippet = buildFunctionCallSnippet(callable, "my_func", "LPF");
        expect(snippet).toBe(
            'LPF my_func\n    STR_VAR\n        name = $1\nEND$0'
        );
    });

    it("generates snippet with prefix for both INT_VAR and STR_VAR params", () => {
        const callable = createCallableInfo(
            [{ name: "x", type: "int", defaultValue: "0", required: true }],
            [{ name: "name", type: "string", defaultValue: '""', required: true }]
        );

        const snippet = buildFunctionCallSnippet(callable, "complex_func", "LAF");
        expect(snippet).toBe(
            'LAF complex_func\n    INT_VAR\n        x = $1\n    STR_VAR\n        name = $2\nEND$0'
        );
    });

    it("generates snippet without prefix when not provided", () => {
        const callable = createCallableInfo(
            [{ name: "x", type: "int", defaultValue: "0", required: true }],
            []
        );

        const snippet = buildFunctionCallSnippet(callable, "my_func");
        expect(snippet).toBe(
            "my_func\n    INT_VAR\n        x = $1\nEND$0"
        );
        expect(snippet).not.toContain("LAF");
        expect(snippet).not.toContain("LPF");
    });
});
