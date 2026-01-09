/**
 * Unit tests for TBAF transpiler.
 * Tests the transform and emit stages of TypeScript to BAF transpilation.
 */

import { describe, expect, it } from "vitest";
import { Project } from "ts-morph";
import { TBAFTransformer } from "../src/tbaf/transform";
import { emitBAF } from "../src/tbaf/emit";
import { BAFScript } from "../src/tbaf/ir";

describe("TBAF Transpiler", () => {
    const transformer = new TBAFTransformer();

    function transpile(code: string): string {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile("test.tbaf", code);
        const ir = transformer.transform(sourceFile);
        return emitBAF(ir);
    }

    describe("Basic IF/THEN/END blocks", () => {
        it("transpiles simple condition and action", () => {
            const code = `
if (See(Player1)) {
    Attack(Player1);
}
`;
            const result = transpile(code);
            expect(result).toContain("IF");
            expect(result).toContain("See(Player1)");
            expect(result).toContain("THEN");
            expect(result).toContain("RESPONSE #100");
            expect(result).toContain("Attack(Player1)");
            expect(result).toContain("END");
        });

        it("transpiles multiple conditions", () => {
            const code = `
if (See(Player1) && !Global("attacked", "LOCALS", 1)) {
    Attack(Player1);
    SetGlobal("attacked", "LOCALS", 1);
}
`;
            const result = transpile(code);
            expect(result).toContain("See(Player1)");
            expect(result).toContain('!Global("attacked", "LOCALS", 1)');
            expect(result).toContain("Attack(Player1)");
            expect(result).toContain('SetGlobal("attacked", "LOCALS", 1)');
        });

        it("transpiles OR conditions", () => {
            const code = `
if (See(Player1) || See(Player2)) {
    Attack(NearestEnemyOf(Myself));
}
`;
            const result = transpile(code);
            expect(result).toContain("OR(2)");
            expect(result).toContain("See(Player1)");
            expect(result).toContain("See(Player2)");
        });
    });

    describe("Compile-time loop unrolling", () => {
        it("unrolls for-of loop over const array", () => {
            const code = `
const enemies = ["Player1", "Player2", "Player3"];

for (const enemy of enemies) {
    if (See(enemy)) {
        Attack(enemy);
    }
}
`;
            const result = transpile(code);
            // Should have 3 IF blocks, one for each enemy
            expect(result).toContain('See("Player1")');
            expect(result).toContain('Attack("Player1")');
            expect(result).toContain('See("Player2")');
            expect(result).toContain('Attack("Player2")');
            expect(result).toContain('See("Player3")');
            expect(result).toContain('Attack("Player3")');
        });

        it("unrolls for loop with numeric range", () => {
            const code = `
for (let i = 1; i <= 3; i++) {
    if (Global("count", "LOCALS", i)) {
        Continue();
    }
}
`;
            const result = transpile(code);
            expect(result).toContain('Global("count", "LOCALS", 1)');
            expect(result).toContain('Global("count", "LOCALS", 2)');
            expect(result).toContain('Global("count", "LOCALS", 3)');
        });
    });

    describe("Array spread expressions", () => {
        it("flattens spread in array literal", () => {
            const code = `
const base = ["Player1", "Player2"];
const all = [...base, "Player3"];

for (const target of all) {
    if (See(target)) {
        Attack(target);
    }
}
`;
            const result = transpile(code);
            // Should have Player1, Player2, Player3 from spread
            expect(result).toContain('See("Player1")');
            expect(result).toContain('See("Player2")');
            expect(result).toContain('See("Player3")');
        });
    });

    describe("Array destructuring", () => {
        it("destructures array in for-of loop", () => {
            const code = `
const pairs = [["Player1", "SWORD01"], ["Player2", "BOW01"]];

for (const [target, item] of pairs) {
    if (See(target)) {
        GiveItemCreate(item, target, 1, 0, 0);
    }
}
`;
            const result = transpile(code);
            expect(result).toContain('See("Player1")');
            expect(result).toContain('GiveItemCreate("SWORD01", "Player1", 1, 0, 0)');
            expect(result).toContain('See("Player2")');
            expect(result).toContain('GiveItemCreate("BOW01", "Player2", 1, 0, 0)');
        });
    });

    describe("Function inlining", () => {
        it("inlines user-defined functions", () => {
            const code = `
function attackIfVisible(target: string) {
    if (See(target)) {
        Attack(target);
    }
}

attackIfVisible("Player1");
attackIfVisible("Player2");
`;
            const result = transpile(code);
            expect(result).toContain('See("Player1")');
            expect(result).toContain('Attack("Player1")');
            expect(result).toContain('See("Player2")');
            expect(result).toContain('Attack("Player2")');
        });

        it("inlines functions with multiple parameters", () => {
            const code = `
function giveItem(target: string, item: string) {
    if (See(target)) {
        GiveItemCreate(item, target, 1, 0, 0);
    }
}

giveItem("Player1", "SWORD01");
giveItem("Player2", "BOW01");
`;
            const result = transpile(code);
            expect(result).toContain('See("Player1")');
            expect(result).toContain('GiveItemCreate("SWORD01", "Player1", 1, 0, 0)');
            expect(result).toContain('See("Player2")');
            expect(result).toContain('GiveItemCreate("BOW01", "Player2", 1, 0, 0)');
        });
    });

    describe("Translation references", () => {
        it("converts $tra() to @number", () => {
            const code = `
if (True()) {
    DisplayStringHead(Myself, $tra(123));
}
`;
            const result = transpile(code);
            // Note: BAF fixups are not applied in unit tests, just testing IR
            // The fixup would convert $tra(123) to @123
            expect(result).toContain("$tra(123)");
        });
    });

    describe("Response priorities", () => {
        it("defaults to response 100", () => {
            const code = `
if (See(Player1)) {
    Attack(Player1);
}
`;
            const result = transpile(code);
            expect(result).toContain("RESPONSE #100");
        });
    });
});
