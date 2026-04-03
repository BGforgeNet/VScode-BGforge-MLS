export class BinaryEditorRefreshGate {
    private suppressNextRefresh = false;

    beginIncrementalEdit(): void {
        this.suppressNextRefresh = true;
    }

    consumeShouldSkipFullRefresh(): boolean {
        if (!this.suppressNextRefresh) {
            return false;
        }

        this.suppressNextRefresh = false;
        return true;
    }

    cancelIncrementalEdit(): void {
        this.suppressNextRefresh = false;
    }
}
