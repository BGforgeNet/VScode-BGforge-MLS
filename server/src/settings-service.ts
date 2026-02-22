/**
 * Settings service - provides document settings access without circular deps.
 * Follows the same holder pattern as lsp-connection.ts.
 * Populated by server.ts during initialization.
 */

import type { MLSsettings } from "./settings";

type SettingsGetter = (resource: string) => Thenable<MLSsettings>;
let getter: SettingsGetter | undefined;

/** Initialize the settings service. Called once during server startup. */
export function initSettingsService(fn: SettingsGetter): void {
    getter = fn;
}

/** Get document settings for a given resource URI. Throws if not initialized. */
export function getDocumentSettings(resource: string): Thenable<MLSsettings> {
    if (!getter) {
        throw new Error("Settings service not initialized. Call initSettingsService first.");
    }
    return getter(resource);
}
