/**
 * Vitest configuration for integration tests using real external fixture files.
 *
 * Separated from the main config because these tests require external repos
 * to be cloned (via scripts/test-external.sh or pnpm test:external).
 * Run with: cd server && pnpm test:integration
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        name: "server-integration",
        include: ["test/integration/**/*.test.ts"],
        setupFiles: ["test/integration/setup.ts"],
    },
});
