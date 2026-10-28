import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import type * as schema from "./schema";

/** The board's database: Cloudflare D1 when deployed, node:sqlite in tests. Both are async SQLite. */
export type Db = BaseSQLiteDatabase<"async", unknown, typeof schema>;

/** True when a write broke a UNIQUE constraint. D1 and node:sqlite both report it in the message. */
export function isUniqueViolation(error: unknown): boolean {
	const seen = new Set<unknown>();
	let current: unknown = error;
	while (current && typeof current === "object" && !seen.has(current)) {
		seen.add(current);
		if (current instanceof Error && /UNIQUE constraint failed/i.test(current.message)) return true;
		current = "cause" in current ? current.cause : null;
	}
	return /UNIQUE constraint failed/i.test(String(error));
}
