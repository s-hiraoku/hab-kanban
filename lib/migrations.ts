import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// Every migrations/*.sql file in name order, as wrangler applies them to D1. Each file is safe to apply twice.
export function migrationSql(root = process.cwd()): string {
	const dir = path.join(root, "migrations");
	return readdirSync(dir)
		.filter((name) => name.endsWith(".sql"))
		.sort()
		.map((name) => readFileSync(path.join(dir, name), "utf8"))
		.join("\n");
}
