import type { User } from "./accounts";
import { bearerMatches, bearerToken, mintBot, mintOwner, tokenFromCookie, type Bot, type Owner } from "./auth";
import { BadRequest } from "./parse";
import { getAccounts, getBoard, type Env } from "./runtime";

export function json(body: unknown, status = 200, headers?: HeadersInit): Response {
	return Response.json(body, { status, headers });
}

export function badRequest(message?: string): Response {
	return json(message ? { error: "bad_request", message } : { error: "bad_request" }, 400);
}

/** The calling Bot's name, from the optional X-Bot-Name header. */
export function botNameFrom(req: Request): string | null {
	const raw = req.headers.get("x-bot-name");
	if (!raw) return null;
	try {
		return decodeURIComponent(raw).trim() || null;
	} catch {
		return raw.trim() || null;
	}
}

export function unauthorized(): Response {
	return json({ error: "unauthorized" }, 401);
}

export function forbidden(): Response {
	return json({ error: "forbidden" }, 403);
}

export function notFound(): Response {
	return json({ error: "not_found" }, 404);
}

export async function readJson(req: Request): Promise<unknown> {
	const text = await req.text();
	if (!text) return {};
	try {
		return JSON.parse(text) as unknown;
	} catch {
		throw new BadRequest();
	}
}

export function sameOrigin(req: Request): boolean {
	const origin = req.headers.get("origin");
	if (!origin) return false;
	return origin === new URL(req.url).origin;
}

export function requestIsSecure(req: Request): boolean {
	const forwarded = req.headers.get("x-forwarded-proto");
	if (forwarded) return forwarded.split(",")[0]?.trim() === "https";
	return new URL(req.url).protocol === "https:";
}

/** The signed-in user, from the session cookie. */
export async function userFromRequest(req: Request, now = Date.now()): Promise<User | null> {
	return getAccounts().userFor(tokenFromCookie(req.headers.get("cookie")), now);
}

/** Whether the session cookie a page received belongs to the owner. Pages call this rather than reading the clock while they render. */
export async function sessionIsOwner(sessionToken: string | undefined, env: Env, now = Date.now()): Promise<boolean> {
	return isOwnerAccount(await getAccounts().userFor(sessionToken, now), env);
}

/** Until each user has a board of their own, only the owner's GitHub account may use this one. */
export function isOwnerAccount(user: User | null, env: Env): user is User {
	return user !== null && user.login.toLowerCase() === env.ownerGithubLogin.toLowerCase();
}

export async function ownerFromRequest(req: Request, env: Env, now = Date.now()): Promise<Owner | null> {
	return isOwnerAccount(await userFromRequest(req, now), env) ? mintOwner() : null;
}

export async function requireOwner(req: Request, env: Env): Promise<Owner | Response> {
	if (!sameOrigin(req)) return forbidden();
	const owner = await ownerFromRequest(req, env);
	if (!owner) return unauthorized();
	return owner;
}

/** A connection's own token, or while agents move over, the shared BOT_TOKEN. */
export async function requireBot(req: Request, env: Env): Promise<Bot | Response> {
	const header = req.headers.get("authorization");
	if (env.botToken && bearerMatches(header, env.botToken)) return mintBot({ kind: "shared" });
	const token = bearerToken(header);
	return (token && (await getBoard().connect(token))) || unauthorized();
}
