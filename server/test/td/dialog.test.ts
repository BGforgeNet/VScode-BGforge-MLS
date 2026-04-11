/**
 * Unit tests for TD dialog preview pipeline.
 * Tests the round-trip: TD source -> ts-morph parse -> emit D -> parseDDialog.
 * Uses the same approach as td.test.ts (no esbuild bundler needed for simple samples).
 */

import { describe, expect, it, beforeAll, vi } from "vitest";
import { Project } from "ts-morph";

// Mock the server module to avoid LSP connection issues
vi.mock("../../src/server", () => ({
    connection: {
        console: { log: vi.fn() },
        sendDiagnostics: vi.fn(),
    },
}));

import { parse } from "../../src/td/parse";
import { emitD } from "../../src/td/emit";
import { extractTraTag } from "../../src/transpiler-utils";
import { parseDDialog } from "../../src/weidu-d/dialog";
import type { DDialogData } from "../../src/weidu-d/dialog";
import { initParser } from "../../src/weidu-d/parser";
import type { TDScript } from "../../src/td/types";

/** Parse TD source to IR (same as td.test.ts). */
function parseIR(code: string): TDScript {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile("test.td", code);
    return { ...parse(sourceFile), traTag: extractTraTag(code) };
}

/** Full round-trip: TD source -> IR -> D text -> DDialogData. */
function tdToDialogData(code: string): DDialogData {
    const dText = emitD(parseIR(code));
    return parseDDialog(dText);
}

beforeAll(async () => {
    await initParser();
});

describe("TD dialog preview", () => {
    describe("BEGIN with states", () => {
        it("produces a begin block with states", () => {
            const result = tdToDialogData(`
function start() {
    say(tra(100));
    exit();
}

begin("MYDLG", [start]);
`);
            expect(result.blocks).toHaveLength(1);
            expect(result.blocks[0]!.kind).toBe("begin");
            expect(result.blocks[0]!.file).toBe("MYDLG");

            expect(result.states).toHaveLength(1);
            expect(result.states[0]!.label).toBe("start");
            expect(result.states[0]!.sayText).toBe("@100");
            expect(result.states[0]!.transitions).toHaveLength(1);
            expect(result.states[0]!.transitions[0]!.target).toEqual({ kind: "exit" });
        });

        it("produces states with GOTO transitions", () => {
            const result = tdToDialogData(`
function greeting() {
    say(tra(1));
    reply(tra(2)).goTo(quest);
    reply(tra(3)).exit();
}

function quest() {
    say(tra(4));
    exit();
}

begin("NPC", [greeting, quest]);
`);
            expect(result.states).toHaveLength(2);

            const greet = result.states[0]!;
            expect(greet.label).toBe("greeting");
            expect(greet.transitions).toHaveLength(2);
            expect(greet.transitions[0]!.replyText).toBe("@2");
            expect(greet.transitions[0]!.target).toEqual({ kind: "goto", label: "quest" });
            expect(greet.transitions[1]!.target).toEqual({ kind: "exit" });
        });

        it("produces states with conditional transitions", () => {
            const result = tdToDialogData(`
function guarded() {
    say(tra(1));
    if (PartyGoldGT(1000)) {
        reply(tra(2)).exit();
    }
    reply(tra(3)).exit();
}

begin("NPC", [guarded]);
`);
            expect(result.states).toHaveLength(1);
            const state = result.states[0]!;
            // Both transitions are emitted (guarded + unguarded)
            expect(state.transitions).toHaveLength(2);
            expect(state.transitions[0]!.replyText).toBe("@2");
            expect(state.transitions[1]!.replyText).toBe("@3");
        });

        it("produces states with EXTERN transitions", () => {
            const result = tdToDialogData(`
function state1() {
    say(tra(1));
    reply(tra(2)).extern("OTHERDLG", "otherstate");
}

begin("NPC", [state1]);
`);
            expect(result.states).toHaveLength(1);
            const t = result.states[0]!.transitions[0]!;
            expect(t.target).toEqual({ kind: "extern", file: "OTHERDLG", label: "otherstate" });
        });
    });

    describe("APPEND", () => {
        it("produces an append block with states", () => {
            const result = tdToDialogData(`
function added() {
    say(tra(1));
    exit();
}

append("EXISTING", [added]);
`);
            expect(result.blocks).toHaveLength(1);
            expect(result.blocks[0]!.kind).toBe("append");
            expect(result.blocks[0]!.file).toBe("EXISTING");

            expect(result.states).toHaveLength(1);
            expect(result.states[0]!.label).toBe("added");
        });
    });

    describe("CHAIN", () => {
        it("produces a chain block with synthetic states", () => {
            const result = tdToDialogData(`
chain(function mychain() {
    say("SPEAKER1", tra(1));
    say("SPEAKER2", tra(2));
    exit();
});
`);
            expect(result.blocks).toHaveLength(1);
            expect(result.blocks[0]!.kind).toBe("chain");
            expect(result.blocks[0]!.label).toBe("mychain");

            expect(result.states.length).toBeGreaterThanOrEqual(1);
            expect(result.states[0]!.label).toBe("mychain");
        });
    });

    describe("EXTEND", () => {
        it("produces an extend block with transitions", () => {
            const result = tdToDialogData(`
const dialog = "TESTDLG";
function state1() {}

extendBottom(dialog, state1, () => {
    reply(tra(1)).exit();
});
`);
            expect(result.blocks).toHaveLength(1);
            expect(result.blocks[0]!.kind).toBe("extend");
        });
    });

    describe("patch operations", () => {
        it("produces modify blocks for ALTER_TRANS", () => {
            const result = tdToDialogData(`
alterTrans("NPC", [1, 2], [0], { trigger: "False()" });
`);
            expect(result.blocks).toHaveLength(1);
            expect(result.blocks[0]!.kind).toBe("modify");
            expect(result.blocks[0]!.actionName).toBe("ALTER_TRANS");
        });

        it("produces modify blocks for ADD_STATE_TRIGGER", () => {
            const result = tdToDialogData(`
addStateTrigger("NPC", [5], "Global(\\"quest\\",\\"GLOBAL\\",1)");
`);
            expect(result.blocks).toHaveLength(1);
            expect(result.blocks[0]!.kind).toBe("modify");
            expect(result.blocks[0]!.actionName).toBe("ADD_STATE_TRIGGER");
        });
    });

    describe("multiple constructs", () => {
        it("produces blocks for mixed begin and append", () => {
            const result = tdToDialogData(`
function s1() {
    say(tra(1));
    exit();
}

function s2() {
    say(tra(2));
    exit();
}

begin("NPC", [s1]);
append("NPC", [s2]);
`);
            expect(result.blocks).toHaveLength(2);
            expect(result.blocks[0]!.kind).toBe("begin");
            expect(result.blocks[1]!.kind).toBe("append");
            expect(result.states).toHaveLength(2);
        });
    });

    describe("empty input", () => {
        it("returns empty data for empty source", () => {
            const result = tdToDialogData("");
            expect(result.blocks).toHaveLength(0);
            expect(result.states).toHaveLength(0);
        });
    });

    describe("error cases", () => {
        it("returns empty data for code with no dialog constructs", () => {
            const result = tdToDialogData(`
const x = 1;
function helper() { return x + 1; }
`);
            expect(result.blocks).toHaveLength(0);
            expect(result.states).toHaveLength(0);
        });

        it("throws on invalid begin call (missing arguments)", () => {
            expect(() => tdToDialogData(`begin();`)).toThrow();
        });

        it("returns empty data for non-function elements in state list", () => {
            const result = tdToDialogData(`begin("NPC", [123]);`);
            expect(result.blocks).toHaveLength(0);
            expect(result.states).toHaveLength(0);
        });
    });

    describe("tra tag", () => {
        it("preserves @tra tag through round-trip", () => {
            const code = `/** @tra mymod.tra */
function s1() {
    say(tra(1));
    exit();
}

begin("NPC", [s1]);
`;
            const ir = parseIR(code);
            expect(ir.traTag).toBe("mymod.tra");

            const dText = emitD(ir);
            expect(dText).toContain("@tra mymod.tra");
        });
    });
});
