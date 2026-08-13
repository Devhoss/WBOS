import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

export default defineConfig(
  globalIgnores([".next/**", "node_modules/**", "next-env.d.ts"]),
  ...nextVitals,
  ...nextTypescript,
  {
    plugins: {
      "react-hooks": reactHooks,
    },
    settings: {
      react: { version: "19.2.8" },
    },
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
);