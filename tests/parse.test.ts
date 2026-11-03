import { expect, test } from "vitest";
import {
	BadRequest,
	botProfileSchema,
	brandPatch,
	contentFromNewCard,
	contentPatchSchema,
	isAvatarData,
	newCardBodySchema,
	ownerCommandSchema,
	parseBody,
	parseJson,
} from "@/lib/parse";

const uuid = "00000000-0000-4000-8000-000000000000";

test("a new card fills in every field it leaves out", () => {
	const content = contentFromNewCard(parseBody(newCardBodySchema, { title: "Fix it" }));
	expect(content).toEqual({
		title: "Fix it",
		body: "",
		notes: "",
		repo: null,
		source: null,
		originalLink: null,
		priority: "normal",
		habTask: null,
		habMessage: null,
		assignees: [],
	});
	const withRepo = contentFromNewCard(parseBody(newCardBodySchema, { title: "x", repo: { url: "https://github.com/a/b" } }));
	expect(withRepo.repo).toEqual({ url: "https://github.com/a/b", startingRef: "main" });
});

test("links must be https, and unknown fields are refused", () => {
	expect(() => parseBody(newCardBodySchema, { title: "x", originalLink: "http://x.com/1" })).toThrow(BadRequest);
	expect(() => parseBody(newCardBodySchema, { title: "x", repo: { url: "javascript:alert(1)" } })).toThrow(BadRequest);
	expect(() => parseBody(newCardBodySchema, { title: "x", column: "done" })).toThrow(BadRequest);
	expect(() => parseBody(newCardBodySchema, { title: "" })).toThrow(BadRequest);
	expect(() => parseBody(newCardBodySchema, { title: "t".repeat(201) })).toThrow(BadRequest);
	expect(() => parseBody(newCardBodySchema, { title: "x", priority: "urgent" })).toThrow(BadRequest);
});

test("a HAB id is one word of printable ASCII, trimmed", () => {
	expect(parseBody(newCardBodySchema, { title: "x", habTask: "  task-0192 " }).habTask).toBe("task-0192");
	for (const bad of ["two words", "タスク", "", "a".repeat(201), "tab\there"]) {
		expect(() => parseBody(newCardBodySchema, { title: "x", habTask: bad }), bad).toThrow(BadRequest);
	}
});

test("a card has at most ten assignees", () => {
	const ten = Array.from({ length: 10 }, (_, index) => `bot-${index}`);
	expect(parseBody(newCardBodySchema, { title: "x", assignees: ten }).assignees).toHaveLength(10);
	expect(() => parseBody(newCardBodySchema, { title: "x", assignees: [...ten, "one-more"] })).toThrow(BadRequest);
	expect(() => parseBody(newCardBodySchema, { title: "x", assignees: ["  "] })).toThrow(BadRequest);
});

test("a patch must change something, and keeps only the fields it names", () => {
	expect(() => parseBody(contentPatchSchema, {})).toThrow(BadRequest);
	expect(brandPatch(parseBody(contentPatchSchema, { notes: "hi" }))).toEqual({ notes: "hi" });
	expect(brandPatch(parseBody(contentPatchSchema, { repo: null, originalLink: null, habTask: null }))).toEqual({ repo: null, originalLink: null, habTask: null });
});

test("an icon is an uploaded image, an https URL, or a short emoji", () => {
	expect(isAvatarData("data:image/png;base64,iVBORw0KGgo=")).toBe(true);
	expect(isAvatarData("data:image/svg+xml;base64,PHN2Zz4=")).toBe(false);
	expect(isAvatarData("data:image/png;base64,<script>")).toBe(false);
	const profile = (avatar: unknown) => botProfileSchema.safeParse({ name: "Scout", avatar }).success;
	expect(profile("🦊")).toBe(true);
	expect(profile("https://example.com/a.png")).toBe(true);
	expect(profile("")).toBe(true);
	expect(profile(null)).toBe(true);
	expect(profile("http://example.com/a.png")).toBe(false);
	expect(profile("not an icon")).toBe(false);
	expect(profile(`data:image/png;base64,${"A".repeat(130_000)}`)).toBe(false);
});

test("a Bot's colour is a six-digit hex, and its name cannot be blank", () => {
	expect(botProfileSchema.safeParse({ name: "Scout", color: "#7aa2ff" }).success).toBe(true);
	expect(botProfileSchema.safeParse({ name: "Scout", color: "red" }).success).toBe(false);
	expect(botProfileSchema.safeParse({ name: "Scout", color: "#fff" }).success).toBe(false);
	expect(botProfileSchema.safeParse({ name: "   " }).success).toBe(false);
});

test("owner commands need a card uuid and a known column, and reject extra fields", () => {
	expect(ownerCommandSchema.safeParse({ type: "move", cardId: uuid, to: "done" }).success).toBe(true);
	expect(ownerCommandSchema.safeParse({ type: "move", cardId: "abc123", to: "done" }).success).toBe(false);
	expect(ownerCommandSchema.safeParse({ type: "move", cardId: uuid, to: "archive" }).success).toBe(false);
	expect(ownerCommandSchema.safeParse({ type: "move", cardId: uuid, to: "done", force: true }).success).toBe(false);
	expect(ownerCommandSchema.safeParse({ type: "drop", cardId: uuid, column: "todo", index: -1 }).success).toBe(false);
	expect(ownerCommandSchema.safeParse({ type: "drop", cardId: uuid, column: "todo", index: 1.5 }).success).toBe(false);
	expect(ownerCommandSchema.safeParse({ type: "explode", cardId: uuid }).success).toBe(false);
	const run = ownerCommandSchema.parse({ type: "run", cardId: uuid });
	expect(run).toEqual({ type: "run", cardId: uuid, bot: null });
});

test("a JSON body that does not parse is a bad request, and an object passes through", () => {
	expect(parseJson('{"a":1}')).toEqual({ a: 1 });
	expect(() => parseJson("{nope")).toThrow(BadRequest);
	const object = { a: 1 };
	expect(parseJson(object)).toBe(object);
});
