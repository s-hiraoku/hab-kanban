import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { openBoard, type BoardHandle } from "./board";
import { createAccounts, type Accounts } from "./accounts";
import { createCursorClient } from "./cursor";
import type { Db } from "./db";
import { createGitHubOAuth, type GitHubOAuth } from "./github";
import { createStore } from "./store";
import * as schema from "./schema";

export type Env = {
	/** The GitHub OAuth app people sign in with. */
	githubClientId: string;
	githubClientSecret: string;
	/** The only GitHub account that may sign in, until each user gets a board of their own. */
	ownerGithubLogin: string;
	/** Where GitHub's sign-in pages and API live. Only the browser tests change them, to point at a stand-in. */
	githubWebUrl: string | null;
	githubApiUrl: string | null;
	/** The shared token every agent used before each got its own. Optional; leave it unset once all have moved. */
	botToken: string | null;
	studioUrl: string | null;
	/** Optional. With it, Run can hand cards to a Cursor cloud agent. */
	cursorApiKey: string | null;
	/** Where the Cursor API lives. Only the browser tests change it, to point at a stand-in. */
	cursorApiUrl: string | null;
};

const MIN_SECRET = 32;

export function env(source: NodeJS.ProcessEnv = process.env): Env {
	const githubClientId = required(source, "GITHUB_CLIENT_ID");
	const githubClientSecret = required(source, "GITHUB_CLIENT_SECRET");
	const ownerGithubLogin = required(source, "OWNER_GITHUB_LOGIN").replace(/^@/, "");
	const botToken = source.BOT_TOKEN?.trim() || null;
	const problems: string[] = [];
	if (!/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(ownerGithubLogin)) problems.push("OWNER_GITHUB_LOGIN must be a GitHub username");
	if (botToken && botToken.length < MIN_SECRET) problems.push("BOT_TOKEN must be at least 32 characters");
	if (botToken === githubClientSecret) problems.push("BOT_TOKEN and GITHUB_CLIENT_SECRET must differ");
	const studio = source.STUDIO_URL?.trim() || null;
	if (studio && !studio.startsWith("https://")) problems.push("STUDIO_URL must start with https://");
	const cursorApiKey = source.CURSOR_API_KEY?.trim() || null;
	if (cursorApiKey && (cursorApiKey === githubClientSecret || cursorApiKey === botToken)) problems.push("CURSOR_API_KEY must differ from GITHUB_CLIENT_SECRET and BOT_TOKEN");
	const cursorApiUrl = source.CURSOR_API_URL?.trim() || null;
	const githubWebUrl = source.GITHUB_WEB_URL?.trim() || null;
	const githubApiUrl = source.GITHUB_API_URL?.trim() || null;
	if (problems.length) throw new Error(problems.join("; "));
	return { githubClientId, githubClientSecret, ownerGithubLogin, githubWebUrl, githubApiUrl, botToken, studioUrl: studio, cursorApiKey, cursorApiUrl };
}

function required(source: NodeJS.ProcessEnv, name: string): string {
	const value = source[name]?.trim() ?? "";
	if (!value) throw new Error(`${name} is required`);
	return value;
}

/** The D1 database bound as DB in wrangler.jsonc. `next dev` gets a local one through OpenNext. */
function database(): Db {
	const { env: bindings } = getCloudflareContext();
	return drizzle(bindings.DB, { schema }) as unknown as Db;
}

// Opened per request: everything a run needs between requests, such as Cursor's last check, lives in the card's stored state.
export function getBoard(): BoardHandle {
	const config = env();
	const cursor = config.cursorApiKey ? createCursorClient({ apiKey: config.cursorApiKey, baseUrl: config.cursorApiUrl ?? undefined }) : null;
	return openBoard({ store: createStore(database() as never), now: () => Date.now() as never, cursor, sharedToken: config.botToken !== null });
}

export function getAccounts(): Accounts {
	return createAccounts(database());
}

export function getGitHub(config: Env = env()): GitHubOAuth {
	return createGitHubOAuth({
		clientId: config.githubClientId,
		clientSecret: config.githubClientSecret,
		webUrl: config.githubWebUrl ?? undefined,
		apiUrl: config.githubApiUrl ?? undefined,
	});
}
