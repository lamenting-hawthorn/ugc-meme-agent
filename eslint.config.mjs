import path from "path";
import { fileURLToPath } from "url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended
});

const config = [
  {
    ignores: [".next/**", "node_modules/**", "public/generated/**"]
  },
  ...compat.extends("next/core-web-vitals")
];

export default config;
