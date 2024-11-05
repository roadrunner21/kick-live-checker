import globals from "globals";
import js from "@eslint/js";

export default [
    {
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: "commonjs",
            globals: {
                ...globals.node,
                ...globals.browser,
            },
        },
    },
    js.configs.recommended,
    {
        rules: {
            "no-unused-vars": ["warn", { args: "none", ignoreRestSiblings: true }],
            "no-console": "error",
            "consistent-return": "error",
            "curly": ["error", "all"],
            "eqeqeq": ["error", "always"],
            "no-var": "error",
            "prefer-const": "error",
            "no-multi-spaces": "error",
            "semi": ["error", "always"],
            "quotes": ["error", "single", { avoidEscape: true }],
            "indent": ["error", 4, { SwitchCase: 2 }],
            "arrow-spacing": ["error", { before: true, after: true }],
            "space-before-function-paren": ["error", "never"],
            "keyword-spacing": ["error", { before: true, after: true }],
            "comma-dangle": ["error", "always-multiline"],
            "object-curly-spacing": ["error", "always"],
            "array-bracket-spacing": ["error", "never"],
            "block-spacing": "error",
            "space-in-parens": ["error", "never"],
            "key-spacing": ["error", { beforeColon: false, afterColon: true }],
            "no-trailing-spaces": "error",
            "eol-last": ["error", "always"],
            "no-duplicate-imports": "error",
            "prefer-arrow-callback": ["error", { allowNamedFunctions: false }],
            "func-style": ["error", "declaration", { allowArrowFunctions: true }],
            "no-multiple-empty-lines": ["error", { max: 1 }],
            "space-infix-ops": "error",
            "no-lonely-if": "error",
            "dot-notation": ["error", { allowKeywords: true }],
            "yoda": ["error", "never"]
        },
    },
];
