/**
 * Vitest configuration for TSSL TypeScript plugin unit tests.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["plugins/tssl-plugin/test/**/*.test.ts"],
    },
});
