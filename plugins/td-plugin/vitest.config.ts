/**
 * Vitest configuration for TD TypeScript plugin unit tests.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["plugins/td-plugin/test/**/*.test.ts"],
    },
});
