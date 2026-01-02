import globals from "globals";

export default [
    {
        files: ["grammar.js"],
        languageOptions: {
            globals: {
                ...globals.node,
                // Tree-sitter DSL globals
                grammar: "readonly",
                seq: "readonly",
                choice: "readonly",
                repeat: "readonly",
                repeat1: "readonly",
                optional: "readonly",
                prec: "readonly",
                token: "readonly",
                field: "readonly",
                alias: "readonly",
            },
            ecmaVersion: "latest",
            sourceType: "module",
        },
        rules: {
            // $ is tree-sitter convention for accessing other rules
            "no-unused-vars": ["error", { argsIgnorePattern: "^[$_]", varsIgnorePattern: "^_" }],
        },
    },
];
