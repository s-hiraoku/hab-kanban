import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
	...nextVitals,
	...nextTs,
	{ files: ["tests/**", "e2e/**"], rules: { "@typescript-eslint/no-explicit-any": "off" } },
	{ ignores: ["cloudflare-env.d.ts", ".next/**", ".open-next/**", ".wrangler/**", "next-env.d.ts", "playwright-report/**", "test-results/**"] },
];

export default config;
