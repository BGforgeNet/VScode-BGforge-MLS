/**
 * Vitest configuration for fallout-update script tests with coverage reporting.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["scripts/fallout-update/test/**/*.test.ts"],
        testTimeout: 30000,
        coverage: {
            provider: "v8",
            reporter: ["text", "html", "lcov"],
            include: ["scripts/fallout-update/src/**/*.ts"],
            exclude: ["scripts/fallout-update/src/**/*.d.ts"],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 80,
                statements: 80,
            },
        },
    },
});
