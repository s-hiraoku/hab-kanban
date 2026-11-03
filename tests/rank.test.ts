import { expect, test } from "vitest";
import { agentHref, cursorPrompt, nextRank, prHref, rankBetween, repoKey, runnerOf, type CardContent, type CardState } from "@/lib/domain";

const sorted = (ranks: string[]) => [...ranks].sort((a, b) => Number(a) - Number(b));

test("a rank between two neighbours sorts between them, and an empty column starts at 1000", () => {
	expect(rankBetween(null, null)).toBe("0000000000001000");
	expect(Number(rankBetween("1000", "2000"))).toBe(1500);
	expect(Number(rankBetween("1000", null))).toBe(2000);
	expect(Number(rankBetween(null, "1000"))).toBe(500);
	const between = rankBetween("1000", "1001");
	expect(Number(between)).toBeGreaterThan(1000);
	expect(Number(between)).toBeLessThan(1001);
});

test("a rank above a first card at 1 or below goes negative and still sorts first", () => {
	const first = rankBetween(null, "1");
	expect(Number(first)).toBeLessThan(1);
	const before = rankBetween(null, first);
	expect(Number(before)).toBeLessThan(Number(first));
	expect(sorted(["1", first, before])).toEqual([before, first, "1"]);
});

test("repeatedly dropping a card at the top keeps every rank distinct and in order", () => {
	const ranks = ["1000"];
	for (let index = 0; index < 30; index++) ranks.unshift(rankBetween(null, ranks[0]!));
	expect(new Set(ranks).size).toBe(ranks.length);
	expect(sorted(ranks)).toEqual(ranks);
});

test("repeatedly dropping between the same two cards stays between them", () => {
	let high = "2000";
	for (let index = 0; index < 15; index++) {
		const mid = rankBetween("1000", high);
		expect(Number(mid)).toBeGreaterThan(1000);
		expect(Number(mid)).toBeLessThan(Number(high));
		high = mid;
	}
});

test("a new card goes after every card, and ranks that are not numbers are ignored", () => {
	expect(nextRank([])).toBe("0000000000001000");
	expect(nextRank(["0000000000001000", "0000000000003000", "0000000000002000"])).toBe("0000000000004000");
	expect(nextRank(["junk", "0000000000001000"])).toBe("0000000000002000");
});

test("Run hands a card to the first Bot among its assignees, in assignee order", () => {
	const bots = [{ id: "scout" }, { id: "ops" }];
	expect(runnerOf(["owner", "ops", "scout"], bots)).toEqual({ id: "ops" });
	expect(runnerOf(["owner", "ghost"], bots)).toBeNull();
	expect(runnerOf([], bots)).toBeNull();
});

const content: CardContent = {
	title: "Fix login",
	body: "  Users loop back to /login.  ",
	notes: "",
	repo: null,
	source: null,
	originalLink: null,
	priority: "normal",
	habTask: null,
	habMessage: null,
	assignees: [],
};

test("the Cursor prompt carries the card, its notes, and the hand-off, skipping what is empty", () => {
	const bare = cursorPrompt(content, { by: "You", instructions: null });
	expect(bare.startsWith("# Fix login\n\nUsers loop back to /login.\n\n")).toBe(true);
	expect(bare).not.toContain("## Notes");
	expect(bare).not.toContain("## From");
	expect(bare).toContain("open a pull request");

	const full = cursorPrompt({ ...content, notes: "found the bug" }, { by: "Scout", instructions: "  check middleware  " });
	expect(full).toContain("## Notes on the card so far\nfound the bug");
	expect(full).toContain("## From Scout\ncheck middleware");
	expect(cursorPrompt(content, { by: "Scout", instructions: "   " })).not.toContain("## From");
});

test("the Cursor prompt keeps only the latest 6000 characters of long notes", () => {
	const notes = `${"a".repeat(7000)}TAIL`;
	const prompt = cursorPrompt({ ...content, notes }, { by: "You", instructions: null });
	const section = prompt.split("## Notes on the card so far\n")[1]!.split("\n\n")[0]!;
	expect(section.length).toBe(6000);
	expect(section.endsWith("TAIL")).toBe(true);
});

test("a repository URL matches Cursor's repoUrl whatever its scheme, case, .git or trailing slash", () => {
	expect(repoKey("https://github.com/S-Hiraoku/Kanban.git")).toBe("github.com/s-hiraoku/kanban");
	expect(repoKey("http://github.com/a/b/")).toBe("github.com/a/b");
	expect(repoKey("github.com/a/b")).toBe("github.com/a/b");
});

test("a card links to its running agent first, then to the last run's agent and pull request", () => {
	const agent = (id: string) => ({ agentId: id, runId: "r", url: `https://cursor.com/agents/${id}` }) as never;
	const last = { kind: "ended", launchId: "l", endedAt: 1, agent: agent("old"), outcome: "finished", prUrl: "https://github.com/a/b/pull/1" } as never;
	const idle: CardState = { kind: "idle", column: "todo", last: null, botRun: null, cursorRun: null };
	expect(agentHref(idle)).toBeNull();
	expect(prHref(idle)).toBeNull();
	expect(agentHref({ ...idle, last })).toBe("https://cursor.com/agents/old");
	expect(prHref({ ...idle, last })).toBe("https://github.com/a/b/pull/1");
	const cursorRun = { launchId: "n", status: "running", agent: agent("new"), by: "owner", from: "todo", startedAt: 0, checkedAt: 0 } as never;
	expect(agentHref({ ...idle, last, cursorRun })).toBe("https://cursor.com/agents/new");
	const launching = { launchId: "n", status: "launching", agent: null, by: "owner", from: "todo", startedAt: 0, checkedAt: 0 } as never;
	expect(agentHref({ ...idle, last, cursorRun: launching })).toBe("https://cursor.com/agents/old");
});
