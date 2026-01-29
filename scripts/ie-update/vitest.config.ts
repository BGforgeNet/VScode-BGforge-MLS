/**
 * Vitest configuration for ie-update script tests with coverage reporting.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["scripts/ie-update/test/**/*.test.ts"],
        testTimeout: 30000,
        coverage: {
            provider: "v8",
            reporter: ["text", "html", "lcov"],
            include: ["scripts/ie-update/src/**/*.ts"],
            exclude: ["scripts/ie-update/src/**/*.d.ts"],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 80,
                statements: 80,
            },
        },
    },
});
