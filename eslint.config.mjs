import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default [
	...nextVitals,
	...nextTs,
	{
		// The UI came over from grokbot-kanban, written before these React Compiler rules existed.
		// Warn until the board components are reworked, then turn them back into errors.
		rules: {
			"react-hooks/purity": "warn",
			"react-hooks/refs": "warn",
			"react-hooks/set-state-in-effect": "warn",
			"react-hooks/immutability": "warn",
			"react-hooks/preserve-manual-memoization": "warn",
		},
	},
	{ files: ["tests/**", "e2e/**"], rules: { "@typescript-eslint/no-explicit-any": "off" } },
	{ ignores: [".next/**", ".open-next/**", "next-env.d.ts", "playwright-report/**", "test-results/**"] },
];
