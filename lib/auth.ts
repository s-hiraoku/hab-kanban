import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Symbol.for keeps capabilities equal when Next loads this module once per route bundle.
const capability: unique symbol = Symbol.for("hab-kanban.capability") as never;
const OWNER = Symbol.for("hab-kanban.owner");
const BOT = Symbol.for("hab-kanban.bot");

export type Owner = { readonly [capability]: typeof OWNER };
/**
 * Who a bot request may act as. A connection's token acts only as the Bots it lists. The shared BOT_TOKEN,
 * kept while agents move to their own tokens, still lets a caller name any Bot, as before.
 */
export type BotScope = { kind: "shared" } | { kind: "connection"; connectionId: string; members: readonly string[] };
export type Bot = { readonly [capability]: typeof BOT; readonly scope: BotScope };

export function mintOwner(): Owner {
	return { [capability]: OWNER };
}
export function mintBot(scope: BotScope): Bot {
	return { [capability]: BOT, scope };
}

export function isOwner(value: Owner): boolean {
	return value[capability] === OWNER;
}
export function isBot(value: Bot): boolean {
	return value[capability] === BOT;
}

export const SESSION_COOKIE = "kanban_session";
/** Holds the OAuth state and PKCE verifier between leaving for GitHub and coming back. */
export const SIGN_IN_COOKIE = "kanban_sign_in";
export const SESSION_DAYS = 30;
const MAX_AGE = SESSION_DAYS * 24 * 60 * 60;
const SIGN_IN_MAX_AGE = 10 * 60;

/** A connection's token. The prefix makes a leaked one easy to recognize and search for. */
export function connectionToken(): string {
	return `habk_${randomToken()}`;
}

/** A fresh random secret, for session tokens, OAuth state, and PKCE verifiers. */
export function randomToken(): string {
	return randomBytes(32).toString("base64url");
}

/** Sessions are stored by this hash, so a leaked database row cannot be replayed as a cookie. */
export function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

export function pkceChallenge(verifier: string): string {
	return createHash("sha256").update(verifier).digest("base64url");
}

export function bearerToken(header: string | null): string | null {
	if (!header) return null;
	return /^Bearer (.+)$/.exec(header)?.[1] ?? null;
}

export function bearerMatches(header: string | null, expected: string): boolean {
	const token = bearerToken(header);
	return token !== null && safeEqual(token, expected);
}

export function sessionCookie(token: string, secure: boolean): string {
	return cookie(SESSION_COOKIE, token, MAX_AGE, secure);
}

export function clearedSessionCookie(secure: boolean): string {
	return cookie(SESSION_COOKIE, "", 0, secure);
}

export function signInCookie(state: string, verifier: string, secure: boolean): string {
	return cookie(SIGN_IN_COOKIE, `${state}.${verifier}`, SIGN_IN_MAX_AGE, secure);
}

export function clearedSignInCookie(secure: boolean): string {
	return cookie(SIGN_IN_COOKIE, "", 0, secure);
}

/** The verifier saved when sign-in started, if the state GitHub sent back is the one we sent. */
export function verifierFor(saved: string | undefined, state: string | null): string | null {
	if (!saved || !state) return null;
	const [expected, verifier] = saved.split(".");
	if (!expected || !verifier || !safeEqual(state, expected)) return null;
	return verifier;
}

export function tokenFromCookie(header: string | null, name: string = SESSION_COOKIE): string | undefined {
	if (!header) return undefined;
	for (const part of header.split(";")) {
		const [key, ...rest] = part.trim().split("=");
		if (key === name) return rest.join("=") || undefined;
	}
	return undefined;
}

// SameSite=Lax lets the session ride along when GitHub redirects back, and keeps it off cross-site posts.
function cookie(name: string, value: string, maxAge: number, secure: boolean): string {
	const secureFlag = secure ? "; Secure" : "";
	return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureFlag}`;
}

function safeEqual(candidate: string, expected: string): boolean {
	const left = createHash("sha256").update(candidate).digest();
	const right = createHash("sha256").update(expected).digest();
	return timingSafeEqual(left, right);
}
