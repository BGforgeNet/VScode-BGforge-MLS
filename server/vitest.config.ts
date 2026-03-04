/**
 * Vitest configuration for server unit tests with coverage reporting.
 *
 * Coverage uses an allowlist approach: only directories/files that are
 * unit-testable without tree-sitter WASM or ts-morph project initialization.
 * Parser-dependent code (providers, formatters, transpiler pipelines) is
 * covered by grammar corpus tests, format sample tests, and e2e tests.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["test/**/*.test.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text", "html", "lcov"],
            // Allowlist: only measure coverage for unit-testable code.
            include: [
                // Core infrastructure (no parser dependency)
                "src/core/**/*.ts",

                // Shared utilities (individually listed to exclude pipeline-dependent ones)
                "src/shared/completion-context.ts",
                "src/shared/editorconfig.ts",
                "src/shared/feature-data.ts",
                "src/shared/format-utils.ts",
                "src/shared/jsdoc.ts",
                "src/shared/parser-factory.ts",
                "src/shared/parser-helpers.ts",
                "src/shared/signature-format.ts",
                "src/shared/signature.ts",
                "src/shared/static-data.ts",
                "src/shared/text-cache.ts",
                "src/shared/weidu-types.ts",

                // Top-level modules testable with mocks
                "src/compile.ts",
                "src/common.ts",
                "src/provider-registry.ts",
                "src/safe-eval.ts",
                "src/settings.ts",
                "src/translation.ts",
                "src/transpiler-utils.ts",
                "src/weidu-compile.ts",
                "src/sslc/ssl_compiler.ts",

                // Language-specific files that ARE unit-testable (pure logic)
                "src/fallout-ssl/header-parser.ts",
                "src/fallout-ssl/macro-utils.ts",
                "src/fallout-ssl/utils.ts",
                "src/tbaf/cnf.ts",
                "src/tbaf/ir.ts",
                "src/tbaf/emit.ts",
                "src/td/types.ts",
                "src/tssl/types.ts",

                // weidu-tp2 (most is unit-testable)
                "src/weidu-tp2/**/*.ts",
                "src/weidu-d/definition.ts",
                "src/weidu-d/parser.ts",
            ],
            exclude: [
                "src/**/*.d.ts",
                "src/**/tree-sitter.d.ts",
                // Format sub-modules tested by pnpm test:format-samples, not unit tests
                "src/weidu-tp2/format/**/*.ts",
                // Provider needs full parser init, tested via e2e
                "src/weidu-tp2/provider.ts",
                "src/weidu-tp2/symbol.ts",
            ],
            thresholds: {
                lines: 80,
                functions: 80,
                // Branch coverage is lower because completion context detectors
                // have many guard-clause branches for rare AST edge cases.
                branches: 75,
                statements: 80,
            },
        },
    },
});
