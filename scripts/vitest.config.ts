/**
 * Vitest configuration for all data update script tests with coverage reporting.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        name: "scripts",
        include: ["scripts/*/test/**/*.test.ts"],
        testTimeout: 30000,
        coverage: {
            provider: "v8",
            reporter: ["text", "html", "lcov"],
            include: ["scripts/*/src/**/*.ts"],
            exclude: ["scripts/*/src/**/*.d.ts"],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 80,
                statements: 80,
            },
        },
    },
});
