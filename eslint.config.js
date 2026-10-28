import tseslint from "typescript-eslint";
import nextVitals from "eslint-config-next/core-web-vitals";

export default tseslint.config(...tseslint.configs.recommended, ...nextVitals, {
  ignores: [".next", "next-env.d.ts"],
});
