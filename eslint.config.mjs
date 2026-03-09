import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";

export default [
    {
        ignores: [
            "node_modules/**",
            "client/node_modules/**",
            "client/out/**",
            "server/node_modules/**",
            "server/out/**",
            "server/src/fallout-ssl/tree-sitter.d.ts", // Auto-generated from grammar
            "server/src/weidu-tp2/tree-sitter.d.ts",  // Auto-generated from grammar
            "server/src/weidu-baf/tree-sitter.d.ts",  // Auto-generated from grammar
            "server/src/weidu-d/tree-sitter.d.ts",    // Auto-generated from grammar
            "server/src/td/td-runtime.d.ts",            // Runtime declarations with intentional `any` types
            "cli/**/node_modules/**",
            "cli/**/out/**",
            "grammars/**",  // Grammars have their own eslint config
        ],
    },
    // TypeScript files
    {
        files: [
            "client/src/**/*.ts",
            "server/src/**/*.ts",
            "cli/**/*.ts",
            "plugins/*/src/**/*.ts",
            "plugins/*/test/**/*.ts",
            "scripts/*/src/**/*.ts",
            "scripts/*/test/**/*.ts",
        ],
        plugins: {
            "@typescript-eslint": typescriptEslint,
        },
        languageOptions: {
            globals: {
                ...globals.node,
            },
            parser: tsParser,
            ecmaVersion: "latest",
            sourceType: "module",
            parserOptions: {
                projectService: {
                    // td-plugin test excluded from its tsconfig (vitest types)
                    allowDefaultProject: ["plugins/tssl-plugin/test/filter-diagnostics.test.ts", "plugins/td-plugin/test/td-plugin.test.ts"],
                },
            },
        },
        rules: {
            "@typescript-eslint/no-empty-interface": "off",
            "@typescript-eslint/ban-ts-comment": [
                "error",
                {
                    "ts-expect-error": {
                        descriptionFormat: "^: (ts|TS)\\d+ because .+$",
                    },
                },
            ],
            "@typescript-eslint/no-explicit-any": "warn",
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
            "@typescript-eslint/no-floating-promises": "error",
            "@typescript-eslint/no-unnecessary-condition": "error",
            "@typescript-eslint/strict-boolean-expressions": ["error", {
                allowNullableBoolean: true,
                allowNullableString: true,
                allowNullableNumber: true,
            }],
        },
    },
    // Ban direct showMessage calls in server code -- use user-messages.ts wrappers instead.
    // Wrappers auto-decode file:// URIs to human-readable paths.
    {
        files: ["server/src/**/*.ts"],
        ignores: ["server/src/user-messages.ts"],
        rules: {
            "no-restricted-syntax": ["error",
                {
                    selector: "MemberExpression[property.name='showInformationMessage']",
                    message: "Use showInfo() from user-messages.ts instead of connection.window.showInformationMessage(). It auto-decodes file:// URIs.",
                },
                {
                    selector: "MemberExpression[property.name='showWarningMessage']",
                    message: "Use showWarning() from user-messages.ts instead of connection.window.showWarningMessage(). It auto-decodes file:// URIs.",
                },
                {
                    selector: "MemberExpression[property.name='showErrorMessage']",
                    message: "Use showError() or showErrorWithActions() from user-messages.ts instead of connection.window.showErrorMessage(). It auto-decodes file:// URIs.",
                },
            ],
        },
    },
];
