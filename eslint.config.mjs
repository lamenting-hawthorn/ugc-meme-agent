import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    ignores: [".next/**", "node_modules/**", "public/generated/**"]
  },
  ...nextVitals
];

export default config;
