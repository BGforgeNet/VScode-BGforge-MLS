import { describe, expect, it } from "vitest";
import { BinaryEditorLocalEditTracker } from "../src/editors/binaryEditor-localEditTracker";

describe("BinaryEditorLocalEditTracker", () => {
    it("detects exact inverse of the latest local edit", () => {
        const tracker = new BinaryEditorLocalEditTracker();
        tracker.record({
            fieldPath: "Header.Flags",
            oldRawValue: 0,
            oldDisplayValue: "(none)",
            newRawValue: 1,
            newDisplayValue: "Hidden",
        });

        expect(tracker.shouldUndo("Header.Flags", 0)).toBe(true);
        expect(tracker.shouldUndo("Header.Flags", 1)).toBe(false);
        expect(tracker.shouldUndo("Header.Other", 0)).toBe(false);
    });

    it("forgets undo eligibility after clear", () => {
        const tracker = new BinaryEditorLocalEditTracker();
        tracker.record({
            fieldPath: "Header.Flags",
            oldRawValue: 0,
            oldDisplayValue: "(none)",
            newRawValue: 1,
            newDisplayValue: "Hidden",
        });

        tracker.clear();
        expect(tracker.shouldUndo("Header.Flags", 0)).toBe(false);
    });
});
