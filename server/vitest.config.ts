/**
 * Vitest configuration for server unit tests.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["test/**/*.test.ts"],
    },
});
