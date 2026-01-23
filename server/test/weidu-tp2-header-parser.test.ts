/**
 * Unit tests for WeiDU TP2 header parser.
 */

import { describe, expect, it, beforeAll } from "vitest";
import { parseHeaderVariables } from "../src/weidu-tp2/header-parser";
import { initParser } from "../src/weidu-tp2/parser";

beforeAll(async () => {
    await initParser();
});

describe("parseHeaderVariables", () => {
    describe("top-level variable extraction", () => {
        it("extracts OUTER_SET variables", () => {
            const input = `OUTER_SET count = 10`;
            const result = parseHeaderVariables(input, "test://file.tph");
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe("count");
            expect(result[0].declarationKind).toBe("set");
            expect(result[0].inferredType).toBe("int");
            expect(result[0].value).toBe("10");
        });

        it("extracts OUTER_SPRINT variables", () => {
            const input = `OUTER_SPRINT name ~hello~`;
            const result = parseHeaderVariables(input, "test://file.tph");
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe("name");
            expect(result[0].declarationKind).toBe("sprint");
            expect(result[0].inferredType).toBe("string");
            expect(result[0].value).toBe("~hello~");
        });

        it("extracts OUTER_TEXT_SPRINT variables", () => {
            const input = `OUTER_TEXT_SPRINT content ~file.txt~`;
            const result = parseHeaderVariables(input, "test://file.tph");
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe("content");
            expect(result[0].declarationKind).toBe("text_sprint");
            expect(result[0].inferredType).toBe("string");
        });
    });

    describe("function body scope isolation", () => {
        it("does not extract variables from DEFINE_ACTION_FUNCTION body", () => {
            const input = `
DEFINE_ACTION_FUNCTION test_func BEGIN
    OUTER_SET local_count = 5
END`;
            const result = parseHeaderVariables(input, "test://file.tph");
            expect(result).toHaveLength(0);
        });

        it("does not extract variables from DEFINE_PATCH_FUNCTION body", () => {
            const input = `
DEFINE_PATCH_FUNCTION test_func BEGIN
    SET patch_var = 42
END`;
            const result = parseHeaderVariables(input, "test://file.tph");
            expect(result).toHaveLength(0);
        });

        it("does not extract variables from nested blocks inside functions", () => {
            const input = `
DEFINE_ACTION_FUNCTION outer BEGIN
    ACTION_IF flag BEGIN
        OUTER_SET nested_var = 100
    END
END`;
            const result = parseHeaderVariables(input, "test://file.tph");
            expect(result).toHaveLength(0);
        });

        it("extracts file-scope variable but not function-local ones", () => {
            const input = `
OUTER_SET global_var = 1
DEFINE_ACTION_FUNCTION test_func BEGIN
    OUTER_SET local_var = 5
END`;
            const result = parseHeaderVariables(input, "test://file.tph");
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe("global_var");
        });

        it("extracts variables nested in control flow outside functions", () => {
            const input = `
ACTION_IF flag BEGIN
    OUTER_SET nested_var = 100
END`;
            const result = parseHeaderVariables(input, "test://file.tph");
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe("nested_var");
        });
    });

    describe("JSDoc support", () => {
        it("extracts JSDoc with @type from top-level variable", () => {
            const input = `
/**
 * Counter for items.
 * @type int
 */
OUTER_SET item_count = 0`;
            const result = parseHeaderVariables(input, "test://file.tph");
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe("item_count");
            expect(result[0].jsdoc).toBeDefined();
            expect(result[0].jsdoc?.type).toBe("int");
            expect(result[0].jsdoc?.desc).toBe("Counter for items.");
        });

        it("does not extract JSDoc variables from inside function bodies", () => {
            const input = `
DEFINE_ACTION_FUNCTION test BEGIN
    /**
     * Temporary storage.
     * @type string
     */
    OUTER_SPRINT temp_str ~default~
END`;
            const result = parseHeaderVariables(input, "test://file.tph");
            expect(result).toHaveLength(0);
        });

        it("handles variables without JSDoc", () => {
            const input = `
// Regular comment
OUTER_SET no_doc = 5`;
            const result = parseHeaderVariables(input, "test://file.tph");
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe("no_doc");
            expect(result[0].jsdoc).toBeUndefined();
        });
    });

    describe("multiple top-level variables", () => {
        it("extracts multiple OUTER_SET variables", () => {
            const input = `
OUTER_SET count = 1
OUTER_SET max_count = 100`;
            const result = parseHeaderVariables(input, "test://file.tph");
            expect(result).toHaveLength(2);
            expect(result[0].name).toBe("count");
            expect(result[1].name).toBe("max_count");
        });

        it("extracts mixed declaration types", () => {
            const input = `
OUTER_SET num = 42
OUTER_SPRINT label ~hello~
OUTER_TEXT_SPRINT path ~file.txt~`;
            const result = parseHeaderVariables(input, "test://file.tph");
            expect(result).toHaveLength(3);
            expect(result[0].declarationKind).toBe("set");
            expect(result[1].declarationKind).toBe("sprint");
            expect(result[2].declarationKind).toBe("text_sprint");
        });
    });

    describe("function definitions are fully excluded", () => {
        it("does not include params or body variables from DEFINE_ACTION_FUNCTION", () => {
            const input = `
OUTER_SET global = 99
DEFINE_ACTION_FUNCTION my_func
    INT_VAR bonus = 0
    STR_VAR name = ~~
BEGIN
    OUTER_SET local_var = 1
END`;
            const result = parseHeaderVariables(input, "test://file.tph");
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe("global");
        });

        it("does not include params or body variables from DEFINE_PATCH_FUNCTION", () => {
            const input = `
OUTER_SET global = 99
DEFINE_PATCH_FUNCTION my_func
    RET result
    RET_ARRAY results
BEGIN
    SET local_var = 42
END`;
            const result = parseHeaderVariables(input, "test://file.tph");
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe("global");
        });
    });
});
