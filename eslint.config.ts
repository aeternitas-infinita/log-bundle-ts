import eslint from "@eslint/js";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default [
    // Base configurations
    eslint.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,

    // Global ignores
    {
        ignores: [
            "**/dist/**",
            "**/node_modules/**",
            "**/*.js",
            "**/*.mjs",
            "**/*.cjs",
            "**/.cache/**",
            "**/coverage/**",
            "**/*.tsbuildinfo",
        ],
    },

    // Main configuration
    {
        files: ["**/*.ts"],
        languageOptions: {
            parserOptions: {
                project: true,
                tsconfigRootDir: __dirname,
            },
        },
        rules: {
            // Performance and Best Practices
            "@typescript-eslint/no-unnecessary-condition": "warn",
            "@typescript-eslint/no-unnecessary-type-assertion": "error",
            "@typescript-eslint/prefer-nullish-coalescing": "warn",
            "@typescript-eslint/prefer-optional-chain": "error",
            "@typescript-eslint/strict-boolean-expressions": "off",
            "@typescript-eslint/no-confusing-void-expression": "off",
            "@typescript-eslint/prefer-regexp-exec": "off",

            // Code Quality
            "@typescript-eslint/explicit-function-return-type": "off",
            "@typescript-eslint/explicit-module-boundary-types": "off",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                },
            ],

            // Style
            "@typescript-eslint/consistent-type-definitions": ["error", "type"],
            "@typescript-eslint/consistent-type-imports": [
                "error",
                {
                    prefer: "type-imports",
                    fixStyle: "inline-type-imports",
                },
            ],

            // Relaxed rules for better DX and library compatibility
            "@typescript-eslint/no-non-null-assertion": "off",
            "@typescript-eslint/no-unsafe-assignment": "warn",
            "@typescript-eslint/no-unsafe-member-access": "warn",
            "@typescript-eslint/no-unsafe-argument": "warn",
            "@typescript-eslint/restrict-template-expressions": "off",
            "@typescript-eslint/use-unknown-in-catch-callback-variable": "off",
            "@typescript-eslint/no-deprecated": "warn",
            "@typescript-eslint/no-base-to-string": "off",
        },
    },
];
