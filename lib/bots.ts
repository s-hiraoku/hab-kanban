import { createHash } from "node:crypto";
import type { Instant } from "./domain";

export type BotProfile = {
	id: string;
	name: string;
	role: string;
	/** An https image URL, or one short emoji or symbol. Null draws initials. */
	avatar: string | null;
	color: string;
	createdAt: Instant;
	lastSeenAt: Instant | null;
	/** Its HAB address, bot@agent.hab. Null for a Bot that only ever named itself over the shared token. */
	address: string | null;
};

export type BotProfilePatch = Partial<Pick<BotProfile, "name" | "role" | "avatar" | "color" | "address">>;

/**
 * HAB's address, normalization version 1: lowercase letters, digits, and inner hyphens, 1 to 48 characters
 * per part, as bot_name@agent_name.hab. Anything else is refused rather than rewritten.
 */
const SLUG = "[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?";
export const HAB_ADDRESS = new RegExp(`^${SLUG}@${SLUG}\\.hab$`);

/** The agent part of an address, which names the product: lab@hermes.hab is a Hermes. */
export function agentOf(address: string): string {
	return address.slice(address.indexOf("@") + 1, -".hab".length);
}

/** A connection: HAB's participant group. Its token acts as the Bots in members and no others. */
export type Connection = {
	id: string;
	name: string;
	members: readonly string[];
	createdAt: Instant;
	lastUsedAt: Instant | null;
};

export const BOT_COLORS = [
	"#7aa2ff",
	"#3dd68c",
	"#e2b340",
	"#e06c75",
	"#c678dd",
	"#56b6c2",
	"#f0883e",
	"#a3be8c",
] as const;

export function botIdFor(name: string): string {
	const slug = name
		.normalize("NFKC")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 32);
	// "owner" is the human owner's own id, so a bot named Owner gets another one.
	if (slug === "owner") return "bot-owner";
	if (slug.length >= 2) return slug;
	return `bot-${createHash("sha256").update(name.normalize("NFKC").trim()).digest("hex").slice(0, 8)}`;
}

export function colorFor(name: string): string {
	const digest = createHash("sha256").update(name).digest();
	return BOT_COLORS[(digest[0] ?? 0) % BOT_COLORS.length] ?? BOT_COLORS[0];
}

export function cleanBotName(name: string): string {
	return name.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, 40);
}
