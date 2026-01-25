/**
 * Vitest configuration for CLI unit and integration tests with coverage reporting.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["cli/test/**/*.test.ts"],
        testTimeout: 30000,
        coverage: {
            provider: "v8",
            reporter: ["text", "html", "lcov"],
            include: ["cli/*/src/**/*.ts"],
            exclude: ["cli/**/*.d.ts"],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 80,
                statements: 80,
            },
        },
    },
});
