/**
 * Vitest configuration for utility script tests with coverage reporting.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["scripts/utils/test/**/*.test.ts"],
        testTimeout: 30000,
        coverage: {
            provider: "v8",
            reporter: ["text", "html", "lcov"],
            include: ["scripts/utils/src/**/*.ts"],
            exclude: ["scripts/utils/src/**/*.d.ts"],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 80,
                statements: 80,
            },
        },
    },
});
