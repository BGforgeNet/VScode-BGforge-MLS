import type { FieldEdit } from "./binaryEditor-document";

export class BinaryEditorLocalEditTracker {
    private lastEdit: FieldEdit | undefined;

    record(edit: FieldEdit): void {
        this.lastEdit = edit;
    }

    clear(): void {
        this.lastEdit = undefined;
    }

    shouldUndo(fieldPath: string, newRawValue: number): boolean {
        return this.lastEdit?.fieldPath === fieldPath && this.lastEdit.oldRawValue === newRawValue;
    }
}
