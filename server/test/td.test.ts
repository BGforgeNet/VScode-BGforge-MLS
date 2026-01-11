/**
 * Unit tests for TD transpiler.
 * Tests the parse and emit stages of TypeScript to WeiDU D transpilation.
 */

import { describe, expect, it } from "vitest";
import { Project } from "ts-morph";
import { TDParser } from "../src/td/parse";
import { emitD } from "../src/td/emit";

describe("TD Transpiler", () => {
    const parser = new TDParser();

    function transpile(code: string): string {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile("test.td", code);
        const ir = parser.parse(sourceFile);
        return emitD(ir);
    }

    describe("BEGIN with states", () => {
        it("transpiles simple begin with state", () => {
            const code = `
function start() {
    say(tra(100));
    exit();
}

begin("MYDLG", [start]);
`;
            const result = transpile(code);
            expect(result).toContain("BEGIN MYDLG");
            expect(result).toContain("IF ~~ start");
            expect(result).toContain("SAY @100");
            expect(result).toContain("EXIT");
        });

        it("transpiles state with multiple say (multisay)", () => {
            const code = `
function greeting() {
    say(tra(100));
    say(tra(101));
    say(tra(102));
    exit();
}

begin("NPC", [greeting]);
`;
            const result = transpile(code);
            expect(result).toContain("SAY @100 = @101 = @102");
        });

        it("transpiles state with transitions", () => {
            const code = `
function shop() {
    say(tra(100));
    reply(tra(101));
    goTo(buyItem);
}

function buyItem() {
    say(tra(200));
    exit();
}

begin("SHOP", [shop, buyItem]);
`;
            const result = transpile(code);
            expect(result).toContain("++ @101 + buyItem");
        });
    });

    describe("State entry triggers", () => {
        it("transpiles if-wrapped function as state with trigger", () => {
            const code = `
if (Global("talked", "GLOBAL", 1)) {
    function returning() {
        say(tra(200));
        exit();
    }
}

begin("NPC", [returning]);
`;
            const result = transpile(code);
            expect(result).toContain('IF ~Global("talked","GLOBAL",1)~ returning');
            expect(result).toContain("SAY @200");
        });

        it("handles multiple states with different triggers", () => {
            const code = `
function start() {
    say(tra(100));
    exit();
}

if (NumTimesTalkedTo(1)) {
    function returning() {
        say(tra(200));
        exit();
    }
}

begin("NPC", [start, returning]);
`;
            const result = transpile(code);
            expect(result).toContain("IF ~~ start");
            expect(result).toContain("IF ~NumTimesTalkedTo(1)~ returning");
        });
    });

    describe("Transition triggers", () => {
        it("transpiles if inside state as transition with trigger", () => {
            const code = `
function shop() {
    say(tra(100));
    if (PartyGoldGT(500)) {
        reply(tra(101));
        goTo(buyExpensive);
    }
    reply(tra(102));
    exit();
}

function buyExpensive() {
    say(tra(200));
    exit();
}

begin("SHOP", [shop, buyExpensive]);
`;
            const result = transpile(code);
            expect(result).toContain("+~PartyGoldGT(500)~+ @101 + buyExpensive");
            expect(result).toContain("++ @102 EXIT");
        });
    });

    describe("CHAIN", () => {
        it("transpiles chain with speaker switches", () => {
            const code = `
chain(function banter() {
    say("NPC1", tra(100));
    say("NPC2", tra(101));
    say("NPC1", tra(102));
    exit();
});
`;
            const result = transpile(code);
            expect(result).toContain("CHAIN");
            expect(result).toContain("NPC1");
            expect(result).toContain("== NPC2");
            expect(result).toContain("@100");
            expect(result).toContain("@101");
        });
    });

    describe("Text references", () => {
        it("emits tra() as @number", () => {
            const code = `
function test() {
    say(tra(123));
    exit();
}

begin("TEST", [test]);
`;
            const result = transpile(code);
            expect(result).toContain("@123");
        });

        it("emits tlk() as #number", () => {
            const code = `
function test() {
    say(tlk(456));
    exit();
}

begin("TEST", [test]);
`;
            const result = transpile(code);
            expect(result).toContain("#456");
        });

        it("emits string literals as ~text~", () => {
            const code = `
function test() {
    say("Hello World");
    exit();
}

begin("TEST", [test]);
`;
            const result = transpile(code);
            expect(result).toContain("~Hello World~");
        });
    });

    describe("Compile-time loop unrolling", () => {
        it("unrolls for-of loop over const array", () => {
            const code = `
const items = ["SWORD", "SHIELD", "HELM"];

function shop() {
    say(tra(100));
    for (const item of items) {
        if (PartyHasItem(item)) {
            reply(tra(101));
            exit();
        }
    }
    exit();
}

begin("SHOP", [shop]);
`;
            const result = transpile(code);
            // Should have 3 transitions, one for each item
            expect(result).toContain('+~PartyHasItem("SWORD")~+');
            expect(result).toContain('+~PartyHasItem("SHIELD")~+');
            expect(result).toContain('+~PartyHasItem("HELM")~+');
        });

        it("unrolls for loop with numeric range", () => {
            const code = `
function countdown() {
    say(tra(100));
    for (let i = 1; i <= 3; i++) {
        reply(tra(i));
        exit();
    }
}

begin("TEST", [countdown]);
`;
            const result = transpile(code);
            expect(result).toContain("@1");
            expect(result).toContain("@2");
            expect(result).toContain("@3");
        });
    });

    describe("Macro inlining", () => {
        it("inlines user function calls", () => {
            const code = `
function buyItem(price: number, item: string) {
    if (PartyGoldGT(price)) {
        reply(tra(100));
        exit();
    }
}

function shop() {
    say(tra(50));
    buyItem(500, "SWORD");
    buyItem(300, "SHIELD");
    exit();
}

begin("SHOP", [shop]);
`;
            const result = transpile(code);
            expect(result).toContain("+~PartyGoldGT(500)~+");
            expect(result).toContain("+~PartyGoldGT(300)~+");
        });
    });

    describe("APPEND", () => {
        it("transpiles append with new state", () => {
            const code = `
function newState() {
    say(tra(100));
    exit();
}

append("EXISTING", newState);
`;
            const result = transpile(code);
            expect(result).toContain("APPEND EXISTING");
            expect(result).toContain("IF ~~ newState");
            expect(result).toContain("END");
        });
    });

    describe("EXTEND", () => {
        it("transpiles extendTop with transition", () => {
            const code = `
extendTop("DLG", "state1", () => {
    reply(tra(100));
    goTo(newState);
});
`;
            const result = transpile(code);
            expect(result).toContain("EXTEND_TOP DLG state1");
        });

        it("transpiles extendBottom with transition", () => {
            const code = `
extendBottom("DLG", "state2", () => {
    reply(tra(200));
    exit();
});
`;
            const result = transpile(code);
            expect(result).toContain("EXTEND_BOTTOM DLG state2");
        });
    });
});
