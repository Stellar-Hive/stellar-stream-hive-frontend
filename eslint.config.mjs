import js from "@eslint/js";
import nextConfig from "eslint-config-next";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default [
  {
    ignores: [".next/", "node_modules/", "dist/", "coverage/"],
  },
  js.configs.recommended,
  ...nextConfig,
  jsxA11y.flatConfigs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-unused-vars": "off",
      "no-console": ["error", { allow: ["error"] }],
    },
  },
];
