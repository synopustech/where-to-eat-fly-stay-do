const { FlatCompat } = require("@eslint/eslintrc");
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Allow unused variables that start with underscore
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "ignoreRestSiblings": true
        }
      ],
      // Reduce strictness for development
      "@typescript-eslint/no-explicit-any": "warn",
      "prefer-const": "warn",
      "react/no-unescaped-entities": "error"
    }
  }
];

module.exports = eslintConfig;
