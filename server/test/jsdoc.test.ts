/**
 * Unit tests for JSDoc parser.
 */

import { describe, expect, it } from "vitest";
import * as jsdoc from "../src/shared/jsdoc";

describe("jsdoc.parse", () => {
    describe("@param parsing", () => {
        it("parses @param with type and name", () => {
            const input = `/**
 * @param {int} count
 */`;
            const result = jsdoc.parse(input);
            expect(result.args).toHaveLength(1);
            expect(result.args[0]).toEqual({ name: "count", type: "int" });
        });

        it("parses @param with type, name, and description", () => {
            const input = `/**
 * @param {string} name The name to use
 */`;
            const result = jsdoc.parse(input);
            expect(result.args).toHaveLength(1);
            expect(result.args[0]).toEqual({
                name: "name",
                type: "string",
                description: "The name to use",
            });
        });

        it("parses @param with description using dash separator", () => {
            const input = `/**
 * @param {bool} enabled - Whether feature is enabled
 */`;
            const result = jsdoc.parse(input);
            expect(result.args).toHaveLength(1);
            expect(result.args[0]).toEqual({
                name: "enabled",
                type: "bool",
                description: "Whether feature is enabled",
            });
        });

        it("parses @param with [name=default] syntax but ignores default", () => {
            // The [name=default] syntax is parsed for compatibility but default is ignored
            // (defaults come from AST, not JSDoc)
            const input = `/**
 * @param {int} [count=0] Number of items
 */`;
            const result = jsdoc.parse(input);
            expect(result.args).toHaveLength(1);
            expect(result.args[0]).toEqual({
                name: "count",
                type: "int",
                description: "Number of items",
            });
        });

        it("parses @arg as alias for @param", () => {
            const input = `/**
 * @arg {string} value
 */`;
            const result = jsdoc.parse(input);
            expect(result.args).toHaveLength(1);
            expect(result.args[0]).toEqual({ name: "value", type: "string" });
        });

        it("parses multiple @param tags", () => {
            const input = `/**
 * @param {int} count
 * @param {string} name
 * @param {bool} enabled
 */`;
            const result = jsdoc.parse(input);
            expect(result.args).toHaveLength(3);
            expect(result.args[0].name).toBe("count");
            expect(result.args[1].name).toBe("name");
            expect(result.args[2].name).toBe("enabled");
        });

        it("parses @param with ! suffix as required", () => {
            const input = `/**
 * @param {int} count! Required parameter
 */`;
            const result = jsdoc.parse(input);
            expect(result.args).toHaveLength(1);
            expect(result.args[0]).toEqual({
                name: "count",
                type: "int",
                required: true,
                description: "Required parameter",
            });
        });

        it("parses mixed required and optional params", () => {
            const input = `/**
 * @param {int} count! Required count
 * @param {string} name Optional name
 * @param {bool} enabled! Required flag
 */`;
            const result = jsdoc.parse(input);
            expect(result.args).toHaveLength(3);
            expect(result.args[0]).toEqual({
                name: "count",
                type: "int",
                required: true,
                description: "Required count",
            });
            expect(result.args[1]).toEqual({
                name: "name",
                type: "string",
                description: "Optional name",
            });
            expect(result.args[2]).toEqual({
                name: "enabled",
                type: "bool",
                required: true,
                description: "Required flag",
            });
        });
    });

    describe("@return parsing", () => {
        it("parses unnamed @return with type", () => {
            const input = `/**
 * @return {int}
 */`;
            const result = jsdoc.parse(input);
            expect(result.ret).toEqual({ type: "int" });
        });

        it("parses @returns as alias", () => {
            const input = `/**
 * @returns {string}
 */`;
            const result = jsdoc.parse(input);
            expect(result.ret).toEqual({ type: "string" });
        });

        it("parses @ret as alias", () => {
            const input = `/**
 * @ret {bool}
 */`;
            const result = jsdoc.parse(input);
            expect(result.ret).toEqual({ type: "bool" });
        });

        it("parses named @return with type and description", () => {
            const input = `/**
 * @return x {int} - x coordinate
 */`;
            const result = jsdoc.parse(input);
            expect(result.rets).toHaveLength(1);
            expect(result.rets![0]).toEqual({
                name: "x",
                type: "int",
                description: "x coordinate",
            });
        });

        it("parses named @return without dash separator", () => {
            const input = `/**
 * @return count {int} number of items
 */`;
            const result = jsdoc.parse(input);
            expect(result.rets).toHaveLength(1);
            expect(result.rets![0]).toEqual({
                name: "count",
                type: "int",
                description: "number of items",
            });
        });

        it("parses named @return without description", () => {
            const input = `/**
 * @return result {string}
 */`;
            const result = jsdoc.parse(input);
            expect(result.rets).toHaveLength(1);
            expect(result.rets![0]).toEqual({
                name: "result",
                type: "string",
            });
        });

        it("parses multiple named @return tags", () => {
            const input = `/**
 * @return x {int} - x coordinate
 * @return y {int} - y coordinate
 */`;
            const result = jsdoc.parse(input);
            expect(result.rets).toHaveLength(2);
            expect(result.rets![0]).toEqual({
                name: "x",
                type: "int",
                description: "x coordinate",
            });
            expect(result.rets![1]).toEqual({
                name: "y",
                type: "int",
                description: "y coordinate",
            });
        });

        it("does not confuse unnamed @return {type} with named @return name {type}", () => {
            const input = `/**
 * @return {int}
 * @return x {int} - named return
 */`;
            const result = jsdoc.parse(input);
            expect(result.ret).toEqual({ type: "int" });
            expect(result.rets).toHaveLength(1);
            expect(result.rets![0]).toEqual({
                name: "x",
                type: "int",
                description: "named return",
            });
        });
    });

    describe("@deprecated parsing", () => {
        it("parses @deprecated without message", () => {
            const input = `/**
 * @deprecated
 */`;
            const result = jsdoc.parse(input);
            expect(result.deprecated).toBe(true);
        });

        it("parses @deprecated with message", () => {
            const input = `/**
 * @deprecated Use new_func instead
 */`;
            const result = jsdoc.parse(input);
            expect(result.deprecated).toBe("Use new_func instead");
        });
    });

    describe("description parsing", () => {
        it("parses single-line description", () => {
            const input = `/**
 * Does something useful.
 */`;
            const result = jsdoc.parse(input);
            expect(result.desc).toBe("Does something useful.");
        });

        it("parses multi-line description", () => {
            const input = `/**
 * Does something useful.
 * With multiple lines.
 */`;
            const result = jsdoc.parse(input);
            expect(result.desc).toBe("Does something useful.\nWith multiple lines.");
        });

        it("excludes @tag lines from description", () => {
            const input = `/**
 * Main description.
 * @param {int} count
 */`;
            const result = jsdoc.parse(input);
            expect(result.desc).toBe("Main description.");
        });
    });

    describe("@type parsing", () => {
        it("parses @type with braces", () => {
            const input = `/**
 * @type {int}
 */`;
            const result = jsdoc.parse(input);
            expect(result.type).toBe("int");
        });

        it("parses @type without braces", () => {
            const input = `/**
 * @type string
 */`;
            const result = jsdoc.parse(input);
            expect(result.type).toBe("string");
        });

        it("parses @type with description", () => {
            const input = `/**
 * Counter variable.
 * @type int
 */`;
            const result = jsdoc.parse(input);
            expect(result.type).toBe("int");
            expect(result.desc).toBe("Counter variable.");
        });

        it("parses single-line JSDoc with @type and description", () => {
            const result = jsdoc.parse(`/** @type int Berserker column in 2da */`);
            expect(result.type).toBe("int");
            expect(result.desc).toBe("Berserker column in 2da");
        });

        it("parses single-line JSDoc with description only", () => {
            const result = jsdoc.parse(`/** Some variable description */`);
            expect(result.type).toBeUndefined();
            expect(result.desc).toBe("Some variable description");
        });

        it("parses single-line JSDoc with @type only", () => {
            const result = jsdoc.parse(`/** @type string */`);
            expect(result.type).toBe("string");
            expect(result.desc).toBeUndefined();
        });

        it("parses single-line JSDoc with @deprecated", () => {
            const result = jsdoc.parse(`/** @deprecated Use new_var instead */`);
            expect(result.deprecated).toBe("Use new_var instead");
        });
    });

    describe("combined parsing", () => {
        it("parses complete JSDoc comment", () => {
            const input = `/**
 * Calculates the sum of values.
 * @param {int} a First value
 * @param {int} b Second value
 * @return {int}
 * @deprecated Use sum_v2 instead
 */`;
            const result = jsdoc.parse(input);
            expect(result.desc).toBe("Calculates the sum of values.");
            expect(result.args).toHaveLength(2);
            expect(result.args[0]).toEqual({ name: "a", type: "int", description: "First value" });
            expect(result.args[1]).toEqual({ name: "b", type: "int", description: "Second value" });
            expect(result.ret).toEqual({ type: "int" });
            expect(result.deprecated).toBe("Use sum_v2 instead");
        });

        it("returns empty args array when no params", () => {
            const input = `/**
 * Simple function.
 */`;
            const result = jsdoc.parse(input);
            expect(result.args).toEqual([]);
        });
    });
});
