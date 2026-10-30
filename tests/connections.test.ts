import { beforeEach, expect, test, vi } from "vitest";
import { BOT_TOKEN, boot, botRequest, ownerRequest, syncRequest, type TestApp } from "./kit";

const holder: { current?: TestApp } = {};

vi.mock("@/lib/runtime", () => ({
	getBoard: () => holder.current!.board,
	getAccounts: () => holder.current!.accounts,
	env: () => holder.current!.env,
}));

const { POST: mcp } = await import("@/app/api/mcp/route");
const { POST: command } = await import("@/app/api/owner/commands/route");
const { POST: sync } = await import("@/app/api/owner/sync/route");

beforeEach(async () => {
	holder.current = await boot();
});

let nextId = 1;
async function call(token: string, name: string, args: Record<string, unknown>) {
	const response = await mcp(botRequest("POST", "/api/mcp", { jsonrpc: "2.0", id: nextId++, method: "tools/call", params: { name, arguments: args } }, token));
	if (response.status !== 200) return { status: response.status, error: null, result: null };
	const result = ((await response.json()) as any).result as { isError?: boolean; structuredContent?: any; content: { text: string }[] };
	return { status: 200, error: result.isError ? (result.content[0]?.text ?? "") : null, result: result.structuredContent };
}

async function owner(body: object) {
	const response = await command(ownerRequest(holder.current!, body));
	return { status: response.status, ...((await response.json()) as any) };
}

async function addBot(name: string, address: string | null) {
	const result = await owner({ type: "saveBot", id: null, profile: { name, role: "", color: null, address } });
	expect(result.status).toBe(200);
	return (result.board.bots as any[]).find((bot) => bot.name === name)!;
}

test("a Bot takes a HAB address, checked against HAB's format and kept unique", async () => {
	const lab = await addBot("Lab", "lab@hermes.hab");
	expect(lab).toMatchObject({ address: "lab@hermes.hab", agent: "hermes" });

	expect((await owner({ type: "saveBot", id: null, profile: { name: "Upper", role: "", color: null, address: "Lab@Hermes.hab" } })).status).toBe(400);
	expect((await owner({ type: "saveBot", id: null, profile: { name: "Dotted", role: "", color: null, address: "a.b@hermes.hab" } })).status).toBe(400);
	const twice = await owner({ type: "saveBot", id: null, profile: { name: "Twin", role: "", color: null, address: "lab@hermes.hab" } });
	expect(twice).toMatchObject({ status: 400, notice: "Lab already has lab@hermes.hab." });

	// Leaving the address out keeps it; null clears it.
	await owner({ type: "saveBot", id: lab.id, profile: { name: "Lab", role: "Experiments", color: null } });
	expect((await owner({ type: "saveBot", id: lab.id, profile: { name: "Lab", role: "Experiments", color: null, address: null } })).board.bots[0]).toMatchObject({
		role: "Experiments",
		address: null,
	});
});

test("a connection's token acts as its own Bots only, and the token is shown once", async () => {
	const lab = await addBot("Lab", "lab@hermes.hab");
	await addBot("Coder", "main@codex.hab");
	const created = await owner({ type: "createConnection", name: "Hermes on the Mac mini", members: [lab.id] });
	expect(created.status).toBe(200);
	const token = created.token as string;
	expect(token).toMatch(/^habk_/);
	expect(created.board.connections).toEqual([{ id: expect.any(String), name: "Hermes on the Mac mini", members: [lab.id], createdAt: expect.any(String), lastUsed: null }]);
	expect(JSON.stringify(created.board)).not.toContain(token);
	const stored = await holder.current!.client.query("select token_hash from connections");
	expect(stored.rows[0]!.token_hash).not.toBe(token);

	// One Bot in the connection, so "bot" may be left out.
	const filed = await call(token, "create_card", { title: "Hermes の実験結果" });
	expect(filed.result.card.createdBy).toBe("Lab");
	expect((await call(token, "board_summary", {})).error).toBeNull();
	expect((await call(token, "add_note", { bot: "lab@hermes.hab", card: filed.result.card.id, text: "再現した" })).result.notes).toContain("Lab] 再現した");

	// It cannot act as another Bot, nor add a Bot to the roster by naming one.
	expect((await call(token, "add_note", { bot: "main@codex.hab", card: filed.result.card.id, text: "x" })).error).toBe(
		'This connection cannot act as "main@codex.hab". It can act as lab@hermes.hab.',
	);
	expect((await call(token, "assign_card", { card: filed.result.card.id, add: ["Stranger"] })).error).toBe('unknown assignee "Stranger"');
	expect((await call(token, "assign_card", { card: filed.result.card.id, add: ["main@codex.hab"] })).result.assignees).toEqual(["Coder"]);

	const board = (await (await sync(syncRequest(holder.current!))).json()) as any;
	expect(board.connections[0].lastUsed).toBe("just now");
	expect(board.bots.map((bot: any) => bot.name).sort()).toEqual(["Coder", "Lab"]);
});

test("a connection with several Bots must say which one it acts as", async () => {
	const research = await addBot("Research", "research@grok-bot.hab");
	const calendar = await addBot("Calendar", "calendar@grok-bot.hab");
	const { token } = await owner({ type: "createConnection", name: "Grok Bot", members: [research.id, calendar.id] });
	const card = (await call(token, "create_card", { bot: "calendar@grok-bot.hab", title: "予定の同期" })).result.card;
	expect(card.createdBy).toBe("Calendar");
	expect((await call(token, "move_card", { card: card.id, to: "todo" })).error).toBeNull();
	expect((await call(token, "list_run_requests", {})).error).toBe('Pass "bot" with the Bot you act as: calendar@grok-bot.hab, research@grok-bot.hab.');
	expect((await call(token, "list_run_requests", { bot: "Research" })).result.count).toBe(0);
});

test("a Bot belongs to one connection, and a revoked connection's token stops working", async () => {
	const lab = await addBot("Lab", "lab@hermes.hab");
	const first = await owner({ type: "createConnection", name: "Hermes", members: [lab.id] });
	expect(await owner({ type: "createConnection", name: "Again", members: [lab.id] })).toMatchObject({ status: 400, notice: "Lab already belongs to Hermes." });
	const id = first.board.connections[0].id;

	const empty = await owner({ type: "updateConnection", id, name: "Hermes (paused)", members: [] });
	expect(empty.board.connections[0]).toMatchObject({ name: "Hermes (paused)", members: [] });
	expect((await call(first.token, "board_summary", {})).error).toBeNull();
	expect((await call(first.token, "start_run", { card: "abcd" })).error).toBe("This connection has no Bots yet. Ask the owner to add yours under Bots & MCP.");

	expect((await owner({ type: "deleteConnection", id })).board.connections).toEqual([]);
	expect((await call(first.token, "board_summary", {})).status).toBe(401);
	expect((await call("habk_not-a-real-token", "board_summary", {})).status).toBe(401);
});

test("removing a Bot takes it out of its connection", async () => {
	const lab = await addBot("Lab", "lab@hermes.hab");
	await owner({ type: "createConnection", name: "Hermes", members: [lab.id] });
	expect((await owner({ type: "deleteBot", id: lab.id })).board.connections[0].members).toEqual([]);
});

test("the shared BOT_TOKEN keeps working until it is unset", async () => {
	expect((await call(BOT_TOKEN, "create_card", { bot: "Newcomer", title: "共有トークン" })).result.card.createdBy).toBe("Newcomer");
	expect(((await (await sync(syncRequest(holder.current!))).json()) as any).sharedToken).toBe(true);
	holder.current!.env = { ...holder.current!.env, botToken: null };
	expect((await call(BOT_TOKEN, "board_summary", {})).status).toBe(401);
});
