/**
 * Vitest configuration for TD TypeScript plugin unit tests.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        name: "td-plugin",
        include: ["plugins/td-plugin/test/**/*.test.ts"],
    },
});
