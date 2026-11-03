import { expect, test } from "vitest";
import { BadRequest } from "@/lib/parse";
import { botNameFrom, isOwnerAccount, readJson, requestIsSecure, sameOrigin } from "@/lib/http";
import type { Env } from "@/lib/runtime";

const at = (headers: Record<string, string>, url = "http://localhost:3000/api/x") => new Request(url, { headers });

test("the Bot name header is URL-decoded, and a malformed one is kept as sent", () => {
	expect(botNameFrom(at({}))).toBeNull();
	expect(botNameFrom(at({ "X-Bot-Name": encodeURIComponent("スカウト") }))).toBe("スカウト");
	expect(botNameFrom(at({ "X-Bot-Name": "  Scout " }))).toBe("Scout");
	expect(botNameFrom(at({ "X-Bot-Name": "100%" }))).toBe("100%");
	expect(botNameFrom(at({ "X-Bot-Name": "%20" }))).toBeNull();
});

test("an empty body reads as an empty object, and broken JSON is a bad request", async () => {
	const post = (body: string) => new Request("http://localhost/x", { method: "POST", body });
	expect(await readJson(post(""))).toEqual({});
	expect(await readJson(post('{"a":1}'))).toEqual({ a: 1 });
	await expect(readJson(post("{nope"))).rejects.toBeInstanceOf(BadRequest);
});

test("an owner request must come from the board's own origin", () => {
	expect(sameOrigin(at({ Origin: "http://localhost:3000" }))).toBe(true);
	expect(sameOrigin(at({}))).toBe(false);
	expect(sameOrigin(at({ Origin: "http://localhost:3001" }))).toBe(false);
	expect(sameOrigin(at({ Origin: "https://localhost:3000" }))).toBe(false);
	expect(sameOrigin(at({ Origin: "null" }))).toBe(false);
});

test("behind a proxy, the first forwarded protocol decides whether the request is secure", () => {
	expect(requestIsSecure(at({}, "https://kanban.example.com/"))).toBe(true);
	expect(requestIsSecure(at({}))).toBe(false);
	expect(requestIsSecure(at({ "X-Forwarded-Proto": "https" }))).toBe(true);
	expect(requestIsSecure(at({ "X-Forwarded-Proto": "https, http" }))).toBe(true);
	expect(requestIsSecure(at({ "X-Forwarded-Proto": "http" }, "https://kanban.example.com/"))).toBe(false);
});

test("the owner's GitHub login matches whatever its case", () => {
	const env = { ownerGithubLogin: "S-Hiraoku" } as Env;
	const user = (login: string) => ({ id: "u", githubId: 1, login, name: null, avatarUrl: null });
	expect(isOwnerAccount(user("s-hiraoku"), env)).toBe(true);
	expect(isOwnerAccount(user("someone-else"), env)).toBe(false);
	expect(isOwnerAccount(null, env)).toBe(false);
});
