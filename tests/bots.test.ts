import { expect, test } from "vitest";
import { BOT_COLORS, HAB_ADDRESS, agentOf, botIdFor, cleanBotName, colorFor } from "@/lib/bots";

test("a Bot's id is a slug of its name, and never the owner's id", () => {
	expect(botIdFor("Scout")).toBe("scout");
	expect(botIdFor("  Chief of Staff!! ")).toBe("chief-of-staff");
	expect(botIdFor("Ｓｃｏｕｔ")).toBe("scout");
	expect(botIdFor("Owner")).toBe("bot-owner");
	expect(botIdFor("a".repeat(50))).toBe("a".repeat(32));
});

test("a name with no usable slug gets a stable hashed id", () => {
	const kana = botIdFor("スカウト");
	expect(kana).toMatch(/^bot-[0-9a-f]{8}$/);
	expect(botIdFor("スカウト")).toBe(kana);
	expect(botIdFor("  スカウト ")).toBe(kana);
	expect(botIdFor("ガイド")).not.toBe(kana);
	expect(botIdFor("x")).toMatch(/^bot-[0-9a-f]{8}$/);
});

test("a Bot name is trimmed, collapsed to single spaces, and cut at 40 characters", () => {
	expect(cleanBotName("  Lab \n\t Bot  ")).toBe("Lab Bot");
	expect(cleanBotName("Ｌａｂ")).toBe("Lab");
	expect(cleanBotName("   ")).toBe("");
	expect(cleanBotName("b".repeat(60))).toHaveLength(40);
});

test("a Bot's colour comes from its name and is always one of the palette's", () => {
	expect(colorFor("Scout")).toBe(colorFor("Scout"));
	for (const name of ["Scout", "Ops", "Lab", "Guide", "スカウト", ""]) expect(BOT_COLORS).toContain(colorFor(name));
});

test("a HAB address is lowercase slug@slug.hab, and anything else is refused rather than rewritten", () => {
	for (const ok of ["lab@hermes.hab", "a@b.hab", "lab-2@my-agent.hab", `${"a".repeat(48)}@b.hab`]) expect(HAB_ADDRESS.test(ok)).toBe(true);
	for (const bad of [
		"Lab@hermes.hab",
		"lab@hermes.com",
		"lab@hermes",
		"-lab@hermes.hab",
		"lab-@hermes.hab",
		"la_b@hermes.hab",
		"lab@@hermes.hab",
		"@hermes.hab",
		"lab@.hab",
		" lab@hermes.hab",
		`${"a".repeat(49)}@b.hab`,
	]) {
		expect(HAB_ADDRESS.test(bad), bad).toBe(false);
	}
});

test("the agent part of an address names the product", () => {
	expect(agentOf("lab@hermes.hab")).toBe("hermes");
	expect(agentOf("ops@claude-code.hab")).toBe("claude-code");
});
