/**
 * Unit tests for WeiDU TP2 function call snippet generation.
 * Tests auto-completion snippets for LAF/LPF/LAM/LPM.
 */

import { describe, expect, it } from "vitest";
import { buildFunctionCallSnippet } from "../../src/weidu-tp2/snippets";
import { CallableContext, CallableDefType, type CallableInfo, type CallableParam } from "../../src/core/symbol";

// Helper to create a CallableInfo with known params
function createCallableInfo(
    intVarParams: CallableParam[],
    strVarParams: CallableParam[]
): CallableInfo {
    return {
        context: CallableContext.Action,
        dtype: CallableDefType.Function,
        params: {
            intVar: intVarParams,
            strVar: strVarParams,
            ret: [],
            retArray: [],
        },
    };
}

// Helper to create a CallableInfo with known-empty params
function createNoParamsCallable(): CallableInfo {
    return createCallableInfo([], []);
}

// Helper to create a CallableInfo with unknown params (static YAML symbols)
function createUnknownParamsCallable(): CallableInfo {
    return {
        context: CallableContext.Action,
        dtype: CallableDefType.Function,
    };
}

describe("weidu-tp2: function call snippet generation", () => {
    // ---- No prefix (lafName/lpfName context — user already typed LAF/LPF) ----

    it("returns null without prefix when function has known-empty params", () => {
        const callable = createNoParamsCallable();
        expect(buildFunctionCallSnippet(callable, "no_param_func")).toBeNull();
    });

    it("returns null without prefix for macro with known-empty params", () => {
        const callable: CallableInfo = {
            context: CallableContext.Action,
            dtype: CallableDefType.Macro,
            params: { intVar: [], strVar: [], ret: [], retArray: [] },
        };
        expect(buildFunctionCallSnippet(callable, "my_macro")).toBeNull();
    });

    it("generates snippet without prefix when params exist (even optional)", () => {
        const callable = createCallableInfo(
            [{ name: "x", type: "int", defaultValue: "0" }],
            []
        );
        expect(buildFunctionCallSnippet(callable, "my_func")).toBe(
            "my_func\n    $0\nEND"
        );
    });

    it("generates snippet without prefix for static symbol with unknown params", () => {
        const callable = createUnknownParamsCallable();
        expect(buildFunctionCallSnippet(callable, "INSTALL_PVRZ")).toBe(
            "INSTALL_PVRZ\n    $0\nEND"
        );
    });

    // ---- LAF/LPF prefix with known params ----

    it("generates single-line snippet with prefix when known-empty params", () => {
        const callable = createNoParamsCallable();
        expect(buildFunctionCallSnippet(callable, "my_func", "LAF")).toBe(
            "LAF my_func END\n$0"
        );
    });

    it("generates multi-line snippet with prefix when params exist", () => {
        const callable = createCallableInfo(
            [{ name: "x", type: "int", defaultValue: "0", required: true }],
            []
        );
        expect(buildFunctionCallSnippet(callable, "my_func", "LAF")).toBe(
            "LAF my_func\n    $0\nEND"
        );
    });

    it("generates multi-line snippet with prefix when only optional params exist", () => {
        const callable = createCallableInfo(
            [{ name: "x", type: "int", defaultValue: "0" }],
            [{ name: "y", type: "string", defaultValue: '""' }]
        );
        expect(buildFunctionCallSnippet(callable, "my_func", "LPF")).toBe(
            "LPF my_func\n    $0\nEND"
        );
    });

    it("generates multi-line snippet with prefix when both INT_VAR and STR_VAR exist", () => {
        const callable = createCallableInfo(
            [{ name: "x", type: "int", defaultValue: "0", required: true }],
            [{ name: "name", type: "string", defaultValue: '""', required: true }]
        );
        expect(buildFunctionCallSnippet(callable, "complex_func", "LAF")).toBe(
            "LAF complex_func\n    $0\nEND"
        );
    });

    // ---- LAF/LPF prefix with unknown params (static YAML symbols) ----

    it("generates multi-line snippet with prefix for static symbol with unknown params", () => {
        const callable = createUnknownParamsCallable();
        expect(buildFunctionCallSnippet(callable, "INSTALL_PVRZ", "LAF")).toBe(
            "LAF INSTALL_PVRZ\n    $0\nEND"
        );
    });

    it("generates multi-line snippet with LPF prefix for static symbol with unknown params", () => {
        const callable = createUnknownParamsCallable();
        expect(buildFunctionCallSnippet(callable, "ADD_AREA_ITEM", "LPF")).toBe(
            "LPF ADD_AREA_ITEM\n    $0\nEND"
        );
    });

    // ---- LAM/LPM prefix (macro launch — no params, no END) ----

    it("generates LAM snippet without END", () => {
        const callable: CallableInfo = {
            context: CallableContext.Action,
            dtype: CallableDefType.Macro,
        };
        expect(buildFunctionCallSnippet(callable, "my_macro", "LAM")).toBe(
            "LAM my_macro\n$0"
        );
    });

    it("generates LPM snippet without END", () => {
        const callable: CallableInfo = {
            context: CallableContext.Patch,
            dtype: CallableDefType.Macro,
        };
        expect(buildFunctionCallSnippet(callable, "SET_BG2_PROFICIENCY", "LPM")).toBe(
            "LPM SET_BG2_PROFICIENCY\n$0"
        );
    });

    it("generates LAM snippet ignoring params", () => {
        const callable = createCallableInfo(
            [{ name: "count", type: "int", defaultValue: "0", required: true }],
            []
        );
        const macroCallable: CallableInfo = {
            ...callable,
            context: CallableContext.Action,
            dtype: CallableDefType.Macro,
        };
        // LAM/LPM don't take inline params — variables are set in calling scope
        expect(buildFunctionCallSnippet(macroCallable, "my_macro", "LAM")).toBe(
            "LAM my_macro\n$0"
        );
    });
});
