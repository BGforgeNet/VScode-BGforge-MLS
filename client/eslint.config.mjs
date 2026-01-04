import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";

export default [
    {
        ignores: ["node_modules/**", "out/**"],
    },
    {
        files: ["src/**/*.ts"],
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
        },
    },
];
