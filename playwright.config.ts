import { defineConfig } from "@playwright/test";

// Browser tests for the board. They build the Worker with OpenNext and serve it with wrangler on a fresh local
// D1 (e2e/serve.mjs), so they exercise what ships. The stand-in GitHub and Cursor addresses and the other
// variables come from e2e/e2e.vars.
const PORT = 3210;
const FAKE_CURSOR = "http://localhost:3299";
const FAKE_GITHUB = "http://localhost:3298";

export default defineConfig({
	testDir: "e2e",
	timeout: 60_000,
	use: { baseURL: `http://localhost:${PORT}`, viewport: { width: 1440, height: 900 } },
	webServer: [
		{
			// Cursor's API, played by a small local server so Run with Cursor can be driven end to end.
			command: "node e2e/fake-cursor.mjs",
			url: `${FAKE_CURSOR}/__agents`,
			reuseExistingServer: false,
			env: { PORT: "3299" },
		},
		{
			// GitHub sign-in, played the same way, so tests sign in without a real account.
			command: "node e2e/fake-github.mjs",
			url: `${FAKE_GITHUB}/__health`,
			reuseExistingServer: false,
			env: { PORT: "3298" },
		},
		{
			command: process.env.E2E_SKIP_BUILD ? "node e2e/serve.mjs" : "npx opennextjs-cloudflare build && node e2e/serve.mjs",
			url: `http://localhost:${PORT}/login`,
			timeout: 300_000,
			reuseExistingServer: false,
			env: { PORT: String(PORT) },
		},
	],
});
