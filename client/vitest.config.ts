/**
 * Vitest configuration for client unit tests
 * (dialog tree builders, TS plugin diagnostic filtering).
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        name: "client",
        include: ["client/test/**/*.test.ts"],
    },
});
