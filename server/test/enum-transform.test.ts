/**
 * Unit tests for enum-transform.ts
 * Tests transformEnums and expandEnumPropertyAccess functions.
 */

import { describe, expect, it } from "vitest";
import { transformEnums, expandEnumPropertyAccess } from "../src/enum-transform";

describe("transformEnums", () => {
    it("transforms numeric enum with auto-increment", () => {
        const input = `enum Color { Red, Green, Blue }`;
        const { code, enumNames } = transformEnums(input);

        expect(code).toContain("const Color_Red = 0;");
        expect(code).toContain("const Color_Green = 1;");
        expect(code).toContain("const Color_Blue = 2;");
        expect(code).toContain("const Color = {");
        expect(enumNames).toContain("Color");
    });

    it("transforms numeric enum with explicit values", () => {
        const input = `enum Status { OK = 200, NotFound = 404 }`;
        const { code } = transformEnums(input);

        expect(code).toContain("const Status_OK = 200;");
        expect(code).toContain("const Status_NotFound = 404;");
    });

    it("transforms auto-increment after gap", () => {
        const input = `enum E { A = 10, B, C }`;
        const { code } = transformEnums(input);

        expect(code).toContain("const E_A = 10;");
        expect(code).toContain("const E_B = 11;");
        expect(code).toContain("const E_C = 12;");
    });

    it("transforms string enum", () => {
        const input = `enum Dir { Up = "UP", Down = "DOWN" }`;
        const { code } = transformEnums(input);

        expect(code).toContain(`const Dir_Up = "UP";`);
        expect(code).toContain(`const Dir_Down = "DOWN";`);
    });

    it("replaces property access with prefixed name", () => {
        const input = `
enum Color { Red, Green, Blue }
const x = Color.Red;
const y = Color.Blue;
`;
        const { code } = transformEnums(input);

        expect(code).toContain("const x = Color_Red;");
        expect(code).toContain("const y = Color_Blue;");
        // Should not contain Color.Red anymore
        expect(code).not.toContain("Color.Red");
        expect(code).not.toContain("Color.Blue");
    });

    it("handles multiple enums in same file", () => {
        const input = `
enum Color { Red, Green }
enum Size { Small = 1, Large = 2 }
const c = Color.Red;
const s = Size.Large;
`;
        const { code, enumNames } = transformEnums(input);

        expect(code).toContain("const Color_Red = 0;");
        expect(code).toContain("const Size_Small = 1;");
        expect(code).toContain("const c = Color_Red;");
        expect(code).toContain("const s = Size_Large;");
        expect(enumNames).toContain("Color");
        expect(enumNames).toContain("Size");
    });

    it("preserves export on enum", () => {
        const input = `export enum E { A, B }`;
        const { code } = transformEnums(input);

        expect(code).toContain("export const E_A = 0;");
        expect(code).toContain("export const E_B = 1;");
        expect(code).toContain("export const E = {");
    });

    it("skips declare enum", () => {
        const input = `declare enum E { A, B }`;
        const { code, enumNames } = transformEnums(input);

        // Should not transform declare enum
        expect(code).not.toContain("const E_A");
        expect(enumNames.size).toBe(0);
    });

    it("handles empty enum", () => {
        const input = `enum Empty {}`;
        const { code, enumNames } = transformEnums(input);

        expect(code).toContain("const Empty = {} as const;");
        expect(enumNames).toContain("Empty");
    });

    it("leaves non-enum property access unchanged", () => {
        const input = `
enum Color { Red }
const obj = { foo: 1 };
const x = obj.foo;
const y = Color.Red;
`;
        const { code } = transformEnums(input);

        expect(code).toContain("obj.foo");
        expect(code).toContain("const y = Color_Red;");
    });

    it("returns input unchanged when no enums present", () => {
        const input = `const x = 42;\nconst y = "hello";`;
        const { code, enumNames } = transformEnums(input);

        expect(code).toBe(input);
        expect(enumNames.size).toBe(0);
    });

    it("handles const enum same as regular enum", () => {
        const input = `const enum Flags { A = 1, B = 2, C = 4 }`;
        const { code, enumNames } = transformEnums(input);

        expect(code).toContain("const Flags_A = 1;");
        expect(code).toContain("const Flags_B = 2;");
        expect(code).toContain("const Flags_C = 4;");
        expect(enumNames).toContain("Flags");
    });

    it("handles enum member referencing earlier member", () => {
        const input = `enum E { A = 1, B = 2, C = A + B }`;
        const { code } = transformEnums(input);

        expect(code).toContain("const E_A = 1;");
        expect(code).toContain("const E_B = 2;");
        expect(code).toContain("const E_C = 3;");
    });
});

describe("expandEnumPropertyAccess", () => {
    it("only emits vars for referenced enum members", () => {
        const input = `var Color = { Red: 0, Green: 1, Blue: 2 };\nvar x = Color.Red;`;
        const result = expandEnumPropertyAccess(input, new Set(["Color"]));

        // Only Red is referenced
        expect(result).toContain("var Color_Red = 0;");
        expect(result).not.toContain("var Color_Green");
        expect(result).not.toContain("var Color_Blue");
        expect(result).toContain("var x = Color_Red;");
    });

    it("emits multiple referenced members", () => {
        const input = `var E = { A: 0, B: 1, C: 2 };\nvar x = E.A + E.C;`;
        const result = expandEnumPropertyAccess(input, new Set(["E"]));

        expect(result).toContain("var E_A = 0;");
        expect(result).toContain("var E_C = 2;");
        expect(result).not.toContain("var E_B");
        expect(result).toContain("var x = E_A + E_C;");
    });

    it("replaces property access in expressions", () => {
        const input = `var E = { A: 0, B: 1 };\nvar x = E.A + E.B;`;
        const result = expandEnumPropertyAccess(input, new Set(["E"]));

        expect(result).toContain("var x = E_A + E_B;");
    });

    it("leaves non-enum objects unchanged", () => {
        const input = `var obj = { A: 0, B: 1 };\nvar x = obj.A;`;
        const result = expandEnumPropertyAccess(input, new Set(["Color"]));

        expect(result).toContain("var obj = { A: 0, B: 1 }");
        expect(result).toContain("obj.A");
    });

    it("returns input unchanged when enumNames is empty", () => {
        const input = `var x = 42;`;
        const result = expandEnumPropertyAccess(input, new Set());

        expect(result).toBe(input);
    });

    it("removes compat object entirely when no members referenced", () => {
        const input = `var Color = { Red: 0, Green: 1 };\nvar x = 42;`;
        const result = expandEnumPropertyAccess(input, new Set(["Color"]));

        expect(result).not.toContain("Color_Red");
        expect(result).not.toContain("Color_Green");
        expect(result).not.toContain("var Color");
        expect(result).toContain("var x = 42;");
    });
});
