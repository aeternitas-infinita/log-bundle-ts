import eslint from "@eslint/js";
import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig([
    eslint.configs.recommended,
    tseslint.configs.strict,
    tseslint.configs.stylistic,
    {
        ignores: ["dist/**/*"],
    },
    {
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                project: "./tsconfig.json",
                tsconfigRootDir: __dirname,
            },
            ecmaVersion: "latest",
            sourceType: "module",
        },
    },
]);
