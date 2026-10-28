import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import { isUniqueViolation } from "@/lib/db";
import { createStore } from "@/lib/store";
import type { CardContent, Instant } from "@/lib/domain";
import { openTestDb } from "./sqlite";

test("a UNIQUE violation from SQLite is recognised, other errors are not", () => {
	const sqlite = new DatabaseSync(":memory:");
	sqlite.exec("CREATE TABLE t (k text UNIQUE); INSERT INTO t VALUES ('a')");
	let error: unknown;
	try {
		sqlite.exec("INSERT INTO t VALUES ('a')");
	} catch (caught) {
		error = caught;
	}
	expect(isUniqueViolation(error)).toBe(true);
	expect(isUniqueViolation(new Error("no such table: t"))).toBe(false);
	expect(isUniqueViolation(new Error("query failed", { cause: error }))).toBe(true);
});

test("two inserts racing on one externalId leave a single card", async () => {
	const store = createStore(openTestDb().db as never);
	const content: CardContent = {
		title: "same",
		body: "",
		notes: "",
		repo: null,
		source: null,
		originalLink: null,
		priority: "normal",
		kind: { type: "text" },
		screening: null,
		assignees: [],
	};
	const row = { externalId: "ext-1", content, rank: "0000000000001000", now: 1 as Instant, createdBy: null };
	const [a, b] = await Promise.all([store.insert(row), store.insert(row)]);
	expect(a.card.id).toBe(b.card.id);
	expect([a.created, b.created].filter(Boolean)).toHaveLength(1);
	expect(await store.all()).toHaveLength(1);
});
