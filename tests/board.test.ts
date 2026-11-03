import { beforeEach, expect, test, vi } from "vitest";
import { mintBot, mintOwner } from "@/lib/auth";
import type { BotBoard, OwnerBoard } from "@/lib/board";
import type { CardContent, CardId } from "@/lib/domain";
import { boot, cardIn, type TestApp } from "./kit";

let app: TestApp;
let owner: OwnerBoard;
let bots: BotBoard;

beforeEach(async () => {
	app = await boot();
	owner = app.board.owner(mintOwner());
	bots = app.board.bot(mintBot({ kind: "shared" }));
});

function content(title: string, extra: Partial<CardContent> = {}): CardContent {
	return { title, body: "", notes: "", repo: null, source: null, originalLink: null, priority: "normal", habTask: null, habMessage: null, assignees: [], ...extra };
}

async function file(title: string, extra: Partial<CardContent> = {}, actor = "Scout") {
	return (await bots.create({ externalId: null, content: content(title, extra) }, actor)).card;
}

async function columnOf(id: string) {
	return cardIn((await owner.view()) as unknown as Parameters<typeof cardIn>[0], id)?.column ?? null;
}

const later = (ms: number) => app.setNow(app.now() + ms);

test("the board refuses capabilities it did not mint", () => {
	expect(() => app.board.owner({} as never)).toThrow("unauthorized");
	expect(() => app.board.bot({} as never)).toThrow("unauthorized");
});

test("a card is found by its full id, a #-prefixed short id, or any unique prefix", async () => {
	const card = await file("Find me");
	const compact = card.id.replaceAll("-", "");
	expect((await bots.find(card.id))?.id).toBe(card.id);
	expect((await bots.find(card.id.toUpperCase()))?.id).toBe(card.id);
	expect((await bots.find(`#${card.shortId}`))?.id).toBe(card.id);
	expect((await bots.find(compact.slice(0, 4)))?.id).toBe(card.id);
	expect(await bots.find("abc")).toBeNull();
	expect(await bots.find("not-an-id")).toBeNull();
	expect(await bots.find("ffffffff-ffff-4fff-8fff-ffffffffffff")).toBeNull();
});

test("a short id that matches several cards asks for more characters", async () => {
	const ids = ["abcd1111-0000-4000-8000-000000000000", "abcd2222-0000-4000-8000-000000000000"];
	const spy = vi.spyOn(crypto, "randomUUID").mockImplementation(() => ids.shift() as never);
	try {
		await file("One");
		await file("Two");
	} finally {
		spy.mockRestore();
	}
	await expect(bots.find("abcd")).rejects.toThrow('card id "abcd" matches 2 cards; use more characters');
	expect((await bots.find("abcd2"))?.title).toBe("Two");
	expect(await bots.find("abc")).toBeNull();
	const result = await owner.execute({ type: "deleteCard", cardId: "abcd1111-0000-4000-8000-000000000000" as CardId });
	expect(result.notice).toBe("Card deleted");
	expect((await bots.find("abcd"))?.title).toBe("Two");
});

test("assignees resolve owner, me, Bot names and addresses, without duplicates", async () => {
	await owner.execute({ type: "saveBot", id: null, profile: { name: "Lab", role: "", color: null, address: "lab@hermes.hab" } });
	const card = await file("Who", { assignees: ["you", "me", "lab@hermes.hab", "LAB", "Owner", "self"] });
	expect(card.assignees.map((member) => member.id)).toEqual(["owner", "scout", "lab"]);
	await expect(bots.create({ externalId: null, content: content("x", { assignees: ["me"] }) })).rejects.toThrow('"me" needs the calling bot\'s name');
});

test("the owner cannot assign a Bot that is not on the roster, and the shared token adds one by naming it", async () => {
	const result = await owner.execute({ type: "create", content: content("x", { assignees: ["Nobody"] }) });
	expect(result).toMatchObject({ error: "bad_request", notice: 'unknown assignee "Nobody"' });
	expect(result.board.columns.flatMap((column) => column.cards)).toHaveLength(0);

	const card = await file("y", { assignees: ["Newcomer"] });
	expect(card.assignees).toEqual([{ id: "newcomer", name: "Newcomer" }]);
	expect((await bots.roster()).map((bot) => bot.name).sort()).toEqual(["Newcomer", "Scout"]);
});

test("assigning adds the caller by default, removes, replaces, and keeps at most ten", async () => {
	const card = await file("Team");
	expect((await bots.assign(card.id, {}, "Scout"))!.assignees.map((m) => m.id)).toEqual(["scout"]);
	expect((await bots.assign(card.id, { add: ["Ops", "owner"] }, "Scout"))!.assignees.map((m) => m.id)).toEqual(["scout", "ops", "owner"]);
	expect((await bots.assign(card.id, { remove: ["me"] }, "Scout"))!.assignees.map((m) => m.id)).toEqual(["ops", "owner"]);
	await expect(bots.assign(card.id, { remove: ["Stranger"] }, "Scout")).rejects.toThrow('unknown assignee "Stranger"');
	expect((await bots.assign(card.id, { set: ["Lab"] }, "Scout"))!.assignees.map((m) => m.id)).toEqual(["lab"]);
	const many = Array.from({ length: 12 }, (_, index) => `Helper ${index}`);
	expect((await bots.assign(card.id, { add: many }, "Scout"))!.assignees).toHaveLength(10);
	expect(await bots.assign("ffff", {}, "Scout")).toBeNull();
});

test("notes are stamped with the time and the Bot, and refuse to grow past 20000 characters", async () => {
	const card = await file("Notes");
	const first = await bots.addNote(card.id, "  looked into it  ", "Scout");
	expect(first!.notes).toBe("[2026-10-11 00:00 Scout] looked into it");
	later(90 * 60_000);
	const second = await bots.addNote(card.id, "fixed", "Ops");
	expect(second!.notes.split("\n")).toEqual(["[2026-10-11 00:00 Scout] looked into it", "[2026-10-11 01:30 Ops] fixed"]);
	await expect(bots.addNote(card.id, "x".repeat(20_000), "Scout")).rejects.toThrow("notes would exceed 20000 characters");
	expect(await bots.addNote("ffff", "x", "Scout")).toBeNull();
});

test("a Bot's move goes to the bottom of the new column and is signed with its reason", async () => {
	const a = await file("A");
	const b = await file("B");
	await bots.move(a.id, "todo", null, "Scout");
	const moved = await bots.move(b.id, "todo", "  triaged ", "Ops");
	expect(moved!.notes).toBe("[2026-10-11 00:00 Ops] Moved from Inbox to Todo: triaged");
	const todo = (await owner.view()).columns.find((column) => column.id === "todo")!;
	expect(todo.cards.map((card) => card.id)).toEqual([a.id, b.id]);

	const same = await bots.move(b.id, "todo", "again", "Ops");
	expect(same!.notes).toBe(moved!.notes);
	expect(await bots.move("ffff", "done", null, "Ops")).toBeNull();
});

test("list filters by column, assignee, unassigned, words in the card, and a limit", async () => {
	await file("Login loops", { body: "redirect", assignees: ["me"] });
	const b = await file("Audio cuts out", { notes: "LOGIN unrelated" });
	await file("Third");
	await bots.move(b.id, "todo", null, "Scout");

	expect((await bots.list({ column: "todo" }, "Scout")).map((c) => c.title)).toEqual(["Audio cuts out"]);
	expect((await bots.list({ assignee: "me" }, "Scout")).map((c) => c.title)).toEqual(["Login loops"]);
	expect((await bots.list({ unassigned: true }, "Scout")).map((c) => c.title).sort()).toEqual(["Audio cuts out", "Third"]);
	expect((await bots.list({ query: "login" }, "Scout")).map((c) => c.title).sort()).toEqual(["Audio cuts out", "Login loops"]);
	expect(await bots.list({ limit: 2 }, "Scout")).toHaveLength(2);
	await expect(bots.list({ assignee: "Nobody" }, "Scout")).rejects.toThrow('unknown assignee "Nobody"');
});

test("a Bot run moves the card to In Progress, and each outcome lands it in its column", async () => {
	for (const [outcome, column] of [
		["done", "done"],
		["review", "inReview"],
		["blocked", "todo"],
	] as const) {
		const card = await file(`Run ${outcome}`, { assignees: ["me"] });
		const asked = await owner.execute({ type: "run", cardId: card.id as CardId, bot: null });
		expect(asked).toMatchObject({ error: null, notice: "Asked Scout to run this card. It starts on the Bot's next check." });
		expect(await columnOf(card.id)).toBe("inProgress");
		expect((await bots.runRequests("Scout")).map((c) => c.id)).toContain(card.id);

		later(60_000);
		const started = await bots.startRun(card.id, "Scout");
		expect(started!.run).toMatchObject({ bot: "Scout", status: "working" });
		// Starting twice is harmless.
		expect((await bots.startRun(card.id, "Scout"))!.run!.status).toBe("working");

		const finished = await bots.finishRun(card.id, outcome, " all set ", "Scout");
		expect(finished!.run).toBeNull();
		expect(finished!.column).toBe(column);
		expect(finished!.notes.split("\n").at(-1)).toMatch(/Scout\] Run .+: all set$/);
	}
});

test("only the Bot a run is for may start or finish it", async () => {
	const card = await file("Mine", { assignees: ["me"] });
	await owner.execute({ type: "run", cardId: card.id as CardId, bot: null });
	await expect(bots.startRun(card.id, "Ops")).rejects.toThrow("This card has no run for Ops");
	await expect(bots.finishRun(card.id, "done", "x", "Ops")).rejects.toThrow("This card has no run for Ops");
	await expect(bots.runRequests(null)).rejects.toThrow('Pass "bot" with your Bot name.');
	expect(await bots.runRequests("Ops")).toEqual([]);
	expect((await bots.runRequests("Ops", true)).map((c) => c.id)).toEqual([card.id]);
});

test("a Bot cannot pass on its own run, or one already started", async () => {
	const card = await file("Pass", { assignees: ["me"] });
	await owner.execute({ type: "run", cardId: card.id as CardId, bot: null });
	await expect(bots.passRun(card.id, null, "Scout")).rejects.toThrow("This run is for you.");
	const passed = await bots.passRun(card.id, "  over to you ", "Coordinator");
	expect(passed!.run).toMatchObject({ passedOnBy: "Coordinator" });
	expect(passed!.notes.split("\n").at(-1)).toMatch(/Coordinator\] Passed the run on to Scout: over to you$/);
	await bots.startRun(card.id, "Scout");
	await expect(bots.passRun(card.id, null, "Coordinator")).rejects.toThrow("Scout has already started this run.");

	const plain = await file("No run");
	await expect(bots.passRun(plain.id, null, "Coordinator")).rejects.toThrow("This card has no run request.");
});

test("Run is refused for a card already running, or one in Done, Review or Won't Do", async () => {
	const card = await file("Twice", { assignees: ["me"] });
	await owner.execute({ type: "run", cardId: card.id as CardId, bot: null });
	expect(await owner.execute({ type: "run", cardId: card.id as CardId, bot: null })).toMatchObject({
		error: "bad_request",
		notice: "Scout already has a run for this card. Cancel it first.",
	});
	expect(await owner.execute({ type: "run", cardId: card.id as CardId, bot: "nobody" })).toMatchObject({ notice: "That bot is not on the roster." });

	for (const column of ["done", "inReview", "wontDo"] as const) {
		const parked = await file(`Parked ${column}`, { assignees: ["me"] });
		await owner.execute({ type: "move", cardId: parked.id as CardId, to: column });
		expect(await owner.execute({ type: "run", cardId: parked.id as CardId, bot: null })).toMatchObject({ error: "bad_request", notice: expect.stringContaining("Run works on cards in Inbox") });
	}
	expect(await owner.execute({ type: "run", cardId: "ffffffff-ffff-4fff-8fff-ffffffffffff" as CardId, bot: null })).toMatchObject({ error: "not_found" });
});

test("Run with a named Bot adds it to the assignees", async () => {
	await owner.execute({ type: "saveBot", id: null, profile: { name: "Ops", role: "", color: null } });
	const card = await file("Ask Ops");
	await owner.execute({ type: "run", cardId: card.id as CardId, bot: "ops" });
	expect((await bots.get(card.id as CardId))!.assignees.map((m) => m.id)).toEqual(["ops"]);
});

test("cancelling a request no Bot picked up sends the card to Todo; work under way stays put", async () => {
	const waiting = await file("Waiting", { assignees: ["me"] });
	await owner.execute({ type: "run", cardId: waiting.id as CardId, bot: null });
	expect(await owner.execute({ type: "stop", cardId: waiting.id as CardId })).toMatchObject({ notice: "Run cancelled" });
	expect(await columnOf(waiting.id)).toBe("todo");

	const working = await file("Working", { assignees: ["me"] });
	await owner.execute({ type: "run", cardId: working.id as CardId, bot: null });
	await bots.startRun(working.id, "Scout");
	await owner.execute({ type: "stop", cardId: working.id as CardId });
	expect(await columnOf(working.id)).toBe("inProgress");
	const after = await bots.get(working.id as CardId);
	expect(after!.run).toBeNull();
	expect(after!.notes.split("\n").at(-1)).toMatch(/You\] Cancelled the run$/);
	await expect(bots.finishRun(working.id, "done", "x", "Scout")).rejects.toThrow("It may have been cancelled by the owner.");
});

test("moving a running card to Done or Won't Do drops its run; other moves keep it", async () => {
	const kept = await file("Kept", { assignees: ["me"] });
	await owner.execute({ type: "run", cardId: kept.id as CardId, bot: null });
	await owner.execute({ type: "move", cardId: kept.id as CardId, to: "inReview" });
	expect((await bots.get(kept.id as CardId))!.run).not.toBeNull();

	for (const to of ["done", "wontDo"] as const) {
		const card = await file(`Drop ${to}`, { assignees: ["me"] });
		await owner.execute({ type: "run", cardId: card.id as CardId, bot: null });
		await owner.execute({ type: "move", cardId: card.id as CardId, to });
		expect((await bots.get(card.id as CardId))!.run).toBeNull();
		expect(await bots.runRequests("Scout")).not.toContainEqual(expect.objectContaining({ id: card.id }));
	}
});

test("a drop past the end of a column lands last, and index 0 lands first", async () => {
	const a = await file("A");
	const b = await file("B");
	const c = await file("C");
	const order = async () => (await owner.view()).columns.find((column) => column.id === "inbox")!.cards.map((card) => card.title);
	await owner.execute({ type: "drop", cardId: a.id as CardId, column: "inbox", index: 99 });
	expect(await order()).toEqual(["B", "C", "A"]);
	await owner.execute({ type: "drop", cardId: c.id as CardId, column: "inbox", index: 0 });
	expect(await order()).toEqual(["C", "B", "A"]);
	await owner.execute({ type: "drop", cardId: b.id as CardId, column: "todo", index: 0 });
	expect(await order()).toEqual(["C", "A"]);
});

test("saving a Bot refuses a blank name, a taken name, and the owner's id", async () => {
	expect(await owner.execute({ type: "saveBot", id: null, profile: { name: "  ", role: "", color: null } })).toMatchObject({ notice: "Give the bot a name." });
	await owner.execute({ type: "saveBot", id: null, profile: { name: "Ops", role: "", color: null } });
	expect(await owner.execute({ type: "saveBot", id: null, profile: { name: "ops", role: "", color: null } })).toMatchObject({ notice: "A bot named Ops already exists." });
	expect(await owner.execute({ type: "saveBot", id: "owner", profile: { name: "Me", role: "", color: null } })).toMatchObject({ error: "bad_request" });
	expect(await owner.execute({ type: "deleteBot", id: "owner" })).toMatchObject({ error: "bad_request" });
	expect(await owner.execute({ type: "deleteBot", id: "nobody" })).toMatchObject({ error: "not_found" });
	// Renaming a Bot to its own name is not a clash.
	expect(await owner.execute({ type: "saveBot", id: "ops", profile: { name: "Ops", role: "runs things", color: null } })).toMatchObject({ notice: "Bot saved" });
	expect(await owner.execute({ type: "saveBot", id: "ghost", profile: { name: "Ghost", role: "", color: null } })).toMatchObject({ error: "not_found" });
});

test("removing a Bot takes it off every card it was assigned to", async () => {
	const one = await file("One", { assignees: ["me", "Ops"] });
	const two = await file("Two", { assignees: ["Ops"] });
	expect(await owner.execute({ type: "deleteBot", id: "ops" })).toMatchObject({ notice: "Bot removed" });
	expect((await bots.get(one.id as CardId))!.assignees.map((m) => m.id)).toEqual(["scout"]);
	expect((await bots.get(two.id as CardId))!.assignees).toEqual([]);
});

test("a Bot updates its own profile, and a blank name is refused", async () => {
	const updated = await bots.updateProfile("Scout", { role: "r".repeat(300), avatar: "  🦊 " });
	expect(updated.role).toHaveLength(200);
	expect(updated.avatar).toBe("🦊");
	await expect(bots.updateProfile("Scout", { name: "   " })).rejects.toThrow("bot name is empty");
	await expect(bots.identify("   ")).rejects.toThrow("bot name is empty");
});

test("the summary shows the caller's run requests and cards, counts, and unassigned Inbox cards", async () => {
	const mine = await file("Mine", { assignees: ["me"] });
	await file("Loose");
	await file("Ops's", { assignees: ["Ops"] });
	await owner.execute({ type: "run", cardId: mine.id as CardId, bot: null });

	const summary = await bots.summary("Scout");
	expect(summary.runRequests.map((card) => card.id)).toEqual([mine.id]);
	expect(summary.mine.map((card) => card.id)).toEqual([mine.id]);
	expect(summary.unassignedInbox).toBe(1);
	expect(Object.fromEntries(summary.columns.map((column) => [column.id, column.count]))).toEqual({ inbox: 2, todo: 0, inProgress: 1, inReview: 0, done: 0, wontDo: 0 });

	const anonymous = await bots.summary(null);
	expect(anonymous.runRequests).toEqual([]);
	expect(anonymous.mine).toEqual([]);
});

test("deleting a card that is gone, or editing one, says not found", async () => {
	const ghost = "ffffffff-ffff-4fff-8fff-ffffffffffff" as CardId;
	expect(await owner.execute({ type: "deleteCard", cardId: ghost })).toMatchObject({ error: "not_found" });
	expect(await owner.execute({ type: "edit", cardId: ghost, patch: { title: "x" } })).toMatchObject({ error: "not_found" });
	expect(await owner.execute({ type: "deleteConnection", id: ghost })).toMatchObject({ error: "not_found" });
	expect(await owner.execute({ type: "updateConnection", id: ghost, name: "x", members: [] })).toMatchObject({ error: "not_found" });
	expect(await bots.patch(ghost, { title: "x" }, "Scout")).toBeNull();
});

test("a connection needs a name and Bots from the roster", async () => {
	expect(await owner.execute({ type: "createConnection", name: "   ", members: [] })).toMatchObject({ error: "bad_request", notice: expect.stringContaining("Give the connection a name") });
	expect(await owner.execute({ type: "createConnection", name: "Hermes", members: ["nobody"] })).toMatchObject({ notice: "That bot is not on the roster." });
	const made = await owner.execute({ type: "createConnection", name: "  Hermes   agent ", members: [] });
	expect(made.token).toMatch(/^habk_/);
	expect(made.board.connections.map((connection) => connection.name)).toEqual(["Hermes agent"]);
});

test("a token the board never issued opens nothing, and use is recorded at most once a minute", async () => {
	expect(await app.board.connect("not-ours")).toBeNull();
	expect(await app.board.connect("habk_made-up")).toBeNull();
	const { token } = await owner.execute({ type: "createConnection", name: "Hermes", members: [] });
	expect(await app.board.connect(token!)).not.toBeNull();
	const used = async () => (await app.client.query<{ last_used_at: number }>("SELECT last_used_at FROM connections")).rows[0]!.last_used_at;
	const first = await used();
	expect(first).toBe(app.now());
	later(30_000);
	await app.board.connect(token!);
	expect(await used()).toBe(first);
	later(31_000);
	await app.board.connect(token!);
	expect(await used()).toBe(app.now());
});
