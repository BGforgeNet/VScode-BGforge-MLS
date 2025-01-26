import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";

export default [
    {
        files: [
            "client/src/*.ts",
            "client/src/test/*.ts",
            "server/src/**/*.ts",
            "preview/src/**/*.ts",
        ],
        ignores: [
            "node_modules/**/*",
            "client/node_modules/**/*",
            "client/out/**/*",
            "server/node_modules/**/*",
            "server/out/**/*",
        ],
    },
    {
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
        },
        rules: {
            "@typescript-eslint/no-empty-interface": "off", // Disable warnings for empty interfaces
            "@typescript-eslint/ban-ts-comment": [
                "error",
                {
                    "ts-expect-error": {
                        descriptionFormat: "^: (ts|TS)\\d+ because .+$",
                    },
                },
            ],
            "@typescript-eslint/no-explicit-any": "warn", // Warn when 'any' is used
            "no-unused-vars": "error", // Disallow unused variables
        },
    },
];
