import { describe, expect, it } from "vitest";
import { BinaryEditorRefreshGate } from "../src/editors/binaryEditor-refreshGate";

describe("BinaryEditorRefreshGate", () => {
    it("skips exactly one full refresh after an incremental edit", () => {
        const gate = new BinaryEditorRefreshGate();

        expect(gate.consumeShouldSkipFullRefresh()).toBe(false);

        gate.beginIncrementalEdit();
        expect(gate.consumeShouldSkipFullRefresh()).toBe(true);
        expect(gate.consumeShouldSkipFullRefresh()).toBe(false);
    });

    it("can cancel a pending incremental edit", () => {
        const gate = new BinaryEditorRefreshGate();

        gate.beginIncrementalEdit();
        gate.cancelIncrementalEdit();

        expect(gate.consumeShouldSkipFullRefresh()).toBe(false);
    });
});
