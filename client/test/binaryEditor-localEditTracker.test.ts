import { describe, expect, it } from "vitest";
import { BinaryEditorLocalEditTracker } from "../src/editors/binaryEditor-localEditTracker";

describe("BinaryEditorLocalEditTracker", () => {
    it("detects exact inverse of the latest local edit", () => {
        const tracker = new BinaryEditorLocalEditTracker();
        tracker.record({
            fieldId: '["Header","Flags"]',
            fieldPath: "Header.Flags",
            oldRawValue: 0,
            oldDisplayValue: "(none)",
            newRawValue: 1,
            newDisplayValue: "Hidden",
            incrementalSafe: true,
        });

        expect(tracker.shouldUndo('["Header","Flags"]', 0)).toBe(true);
        expect(tracker.shouldUndo('["Header","Flags"]', 1)).toBe(false);
        expect(tracker.shouldUndo('["Header","Other"]', 0)).toBe(false);
    });

    it("forgets undo eligibility after clear", () => {
        const tracker = new BinaryEditorLocalEditTracker();
        tracker.record({
            fieldId: '["Header","Flags"]',
            fieldPath: "Header.Flags",
            oldRawValue: 0,
            oldDisplayValue: "(none)",
            newRawValue: 1,
            newDisplayValue: "Hidden",
            incrementalSafe: true,
        });

        tracker.clear();
        expect(tracker.shouldUndo('["Header","Flags"]', 0)).toBe(false);
    });

    it("does not use undo-shortcut for non-incremental structural edits", () => {
        const tracker = new BinaryEditorLocalEditTracker();
        tracker.record({
            fieldId: '["Header","Object Type"]',
            fieldPath: "Header.Object Type",
            oldRawValue: 5,
            oldDisplayValue: "Misc",
            newRawValue: 1,
            newDisplayValue: "Critter",
            incrementalSafe: false,
        });

        expect(tracker.shouldUndo('["Header","Object Type"]', 5)).toBe(false);
    });
});
