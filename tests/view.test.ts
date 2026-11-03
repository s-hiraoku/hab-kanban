import { expect, test } from "vitest";
import type { BotProfile } from "@/lib/bots";
import type { Card, CardId, Instant } from "@/lib/domain";
import { ageLabel, avatarUrl, initialsOf, memberOf, ownerAvatarUrl, toBoardView, toCardView } from "@/lib/view";

const bot = (id: string, extra: Partial<BotProfile> = {}): BotProfile => ({
	id,
	name: id,
	role: "",
	avatar: null,
	color: "#7aa2ff",
	createdAt: 0 as Instant,
	lastSeenAt: null,
	address: null,
	...extra,
});

function card(id: string, extra: Partial<Card> = {}, content: Partial<Card["content"]> = {}): Card {
	return {
		id: id as CardId,
		createdAt: 0 as Instant,
		createdBy: null,
		rank: "1000",
		version: 1,
		state: { kind: "idle", column: "todo", last: null, botRun: null, cursorRun: null },
		content: {
			title: id,
			body: "",
			notes: "",
			repo: null,
			source: null,
			originalLink: null,
			priority: "normal",
			habTask: null,
			habMessage: null,
			assignees: [],
			...content,
		},
		...extra,
	};
}

test("an age reads just now, then minutes, hours up to two days, then days", () => {
	const min = 60_000;
	expect(ageLabel(0, 59_999)).toBe("just now");
	expect(ageLabel(0, min)).toBe("1m");
	expect(ageLabel(0, 59 * min)).toBe("59m");
	expect(ageLabel(0, 60 * min)).toBe("1h");
	expect(ageLabel(0, 47 * 60 * min)).toBe("47h");
	expect(ageLabel(0, 48 * 60 * min)).toBe("2d");
	// A clock that runs behind never shows a negative age.
	expect(ageLabel(10 * min, 0)).toBe("just now");
});

test("initials take the first and last word of a Latin name, and the first character otherwise", () => {
	expect(initialsOf("Chief of Staff")).toBe("CS");
	expect(initialsOf("lab_bot")).toBe("LB");
	expect(initialsOf("scout")).toBe("SC");
	expect(initialsOf("  ")).toBe("?");
	expect(initialsOf("スカウト")).toBe("ス");
	expect(initialsOf("🤖 Bot")).toBe("🤖");
});

test("an uploaded icon is served from the avatar route with a version that changes with the image", () => {
	expect(avatarUrl({ id: "scout", avatar: null })).toBeNull();
	expect(avatarUrl({ id: "scout", avatar: "🦊" })).toBe("🦊");
	expect(avatarUrl({ id: "scout", avatar: "https://example.com/a.png" })).toBe("https://example.com/a.png");
	// The version samples every 7th character, so these differ at index 28.
	const one = avatarUrl({ id: "lab bot", avatar: "data:image/png;base64,AAAAAAAA" })!;
	const two = avatarUrl({ id: "lab bot", avatar: "data:image/png;base64,AAAAAABA" })!;
	const longer = avatarUrl({ id: "lab bot", avatar: "data:image/png;base64,AAAAAAAAAAAA" })!;
	expect(one).toMatch(/^\/api\/avatar\/lab%20bot\?v=[0-9a-z]+-30$/);
	expect(new Set([one, two, longer]).size).toBe(3);
	expect(avatarUrl({ id: "lab bot", avatar: "data:image/png;base64,AAAAAAAA" })).toBe(one);
});

test("the owner's icon is the default until one is uploaded", () => {
	expect(ownerAvatarUrl([])).toBe("/api/avatar/owner?v=default");
	expect(ownerAvatarUrl([bot("owner", { avatar: null })])).toBe("/api/avatar/owner?v=default");
	expect(ownerAvatarUrl([bot("owner", { avatar: "data:image/png;base64,AAAA" })])).toMatch(/^\/api\/avatar\/owner\?v=/);
});

test("an assignee who left the roster still shows, by id, as unknown", () => {
	expect(memberOf("ghost-bot", [])).toEqual({ id: "ghost-bot", name: "ghost-bot", kind: "unknown", avatar: null, color: "#5b616b", initials: "GB" });
	expect(memberOf("owner", []).kind).toBe("owner");
	expect(memberOf("scout", [bot("scout", { name: "Scout" })])).toMatchObject({ kind: "bot", name: "Scout", initials: "SC" });
});

test("a card shows its repository as owner/name, without .git", () => {
	const label = (url: string) => toCardView(card("c", {}, { repo: { url: url as never, startingRef: "main" } }), [], 0).repoLabel;
	expect(label("https://github.com/s-hiraoku/hab-kanban.git")).toBe("s-hiraoku/hab-kanban");
	expect(label("https://github.com/s-hiraoku/hab-kanban/tree/main")).toBe("s-hiraoku/hab-kanban");
	expect(label("https://gitlab.example.com")).toBe("gitlab.example.com");
	expect(toCardView(card("c"), [], 0).repoLabel).toBeNull();
});

test("columns list their cards by rank, ties broken by id, with counts", () => {
	const cards = [
		card("b", { rank: "2000" }),
		card("a", { rank: "2000" }),
		card("c", { rank: "-5" }),
		card("d", { rank: "1000", state: { kind: "idle", column: "done", last: null, botRun: null, cursorRun: null } }),
	];
	const view = toBoardView(cards, [], 0);
	expect(view.columns.map((column) => column.id)).toEqual(["inbox", "todo", "inProgress", "inReview", "done", "wontDo"]);
	const todo = view.columns.find((column) => column.id === "todo")!;
	expect(todo.cards.map((item) => item.id)).toEqual(["c", "a", "b"]);
	expect(todo.count).toBe(3);
	expect(view.columns.find((column) => column.id === "done")!.count).toBe(1);
	expect(view.columns.find((column) => column.id === "inbox")!.count).toBe(0);
});

test("the roster leaves out the owner's icon row, and a connection lists only Bots still on it", () => {
	const view = toBoardView([], [bot("owner"), bot("scout")], 120_000, {
		cursorEnabled: true,
		connections: [{ id: "c1", name: "Hermes", members: ["scout", "gone"], createdAt: 0 as Instant, lastUsedAt: 0 as Instant }],
		sharedToken: true,
	});
	expect(view.bots.map((item) => item.id)).toEqual(["scout"]);
	expect(view.connections[0]).toMatchObject({ members: ["scout"], lastUsed: "2m", createdAt: "1970-01-01T00:00:00.000Z" });
	expect(view.cursor.enabled).toBe(true);
	expect(view.sharedToken).toBe(true);
});
