import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import type { Db } from "@/lib/db";
import { migrationSql } from "@/lib/migrations";
import * as schema from "@/lib/schema";

/** Raw access for tests that write rows the board would not, such as states from older versions. */
export type SqlClient = {
	query<R = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: R[] }>;
};

/** An in-memory SQLite with the D1 migrations applied, behind the same drizzle API as D1. */
export function openTestDb(): { db: Db; client: SqlClient } {
	const sqlite = new DatabaseSync(":memory:");
	sqlite.exec("PRAGMA foreign_keys = ON");
	sqlite.exec(migrationSql());
	const db = drizzle(
		async (text, params, method) => {
			const statement = sqlite.prepare(text);
			const values = params as SQLInputValue[];
			if (method === "run") {
				statement.run(...values);
				return { rows: [] };
			}
			statement.setReturnArrays(true);
			if (method === "get") return { rows: (statement.get(...values) as unknown[] | undefined) ?? [] };
			return { rows: statement.all(...values) as unknown[] };
		},
		{ schema },
	) as unknown as Db;
	const client: SqlClient = {
		async query(text, params = []) {
			// Tests write Postgres-style $1 placeholders and pass objects for JSON columns.
			const values = params.map((value) => (value !== null && typeof value === "object" ? JSON.stringify(value) : value)) as SQLInputValue[];
			const rows = sqlite.prepare(text.replace(/\$\d+/g, "?")).all(...values);
			return { rows: rows as never };
		},
	};
	return { db, client };
}
