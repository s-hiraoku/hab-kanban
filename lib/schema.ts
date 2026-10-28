import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const cards = sqliteTable("cards", {
	id: text("id").primaryKey(),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	externalId: text("external_id"),
	title: text("title").notNull(),
	body: text("body").notNull(),
	notes: text("notes").notNull(),
	repo: text("repo", { mode: "json" }),
	source: text("source"),
	originalLink: text("original_link"),
	priority: text("priority").notNull(),
	kind: text("kind", { mode: "json" }).notNull(),
	screening: text("screening", { mode: "json" }),
	assignees: text("assignees", { mode: "json" }).notNull(),
	createdBy: text("created_by"),
	rank: text("rank").notNull(),
	state: text("state", { mode: "json" }).notNull(),
	stateVersion: integer("state_version").notNull(),
});

export const bots = sqliteTable("bots", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	role: text("role").notNull(),
	avatar: text("avatar"),
	color: text("color").notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }),
});

export const users = sqliteTable("users", {
	id: text("id").primaryKey(),
	githubId: integer("github_id").notNull(),
	login: text("login").notNull(),
	name: text("name"),
	avatarUrl: text("avatar_url"),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	lastSignInAt: integer("last_sign_in_at", { mode: "timestamp_ms" }).notNull(),
});

export const sessions = sqliteTable("sessions", {
	tokenHash: text("token_hash").primaryKey(),
	userId: text("user_id").notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});
