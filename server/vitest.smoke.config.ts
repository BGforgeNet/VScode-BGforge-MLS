/**
 * Vitest configuration for the server smoke test.
 * Separated from the main config because it requires a built server bundle.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        name: "server-smoke",
        include: ["test/smoke-stdio.test.ts"],
    },
});
