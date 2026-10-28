// Serves the built Worker for the browser tests on a fresh local D1, with the stand-in services' addresses.
// The Worker sees its real localhost origin rather than the custom domain in wrangler.jsonc, so sign-in
// comes back here. Every run starts from an empty board: the tests name their cards uniquely, so they share the one database.
import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

const PERSIST = ".wrangler/e2e";
const port = process.env.PORT ?? "3210";
const wrangler = (args, options) => [process.execPath, ["node_modules/wrangler/bin/wrangler.js", ...args], options];

rmSync(PERSIST, { recursive: true, force: true });
const migrate = spawnSync(...wrangler(["d1", "migrations", "apply", "hab-kanban", "--local", "--persist-to", PERSIST], { stdio: "inherit" }));
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

const server = spawn(
	...wrangler(["dev", "--port", port, "--persist-to", PERSIST, "--env-file", "e2e/e2e.vars", "--infer-origin-from-routes=false", "--show-interactive-dev-session=false", "--log-level", "warn"], {
		stdio: "inherit",
		env: { ...process.env, NO_PROXY: "localhost,127.0.0.1", no_proxy: "localhost,127.0.0.1" },
	}),
);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
server.on("exit", (code) => process.exit(code ?? 0));
