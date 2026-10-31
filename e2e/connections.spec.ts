import { expect, test } from "@playwright/test";
import { cardTitled, signIn, tool, unique } from "./helpers";

test("the owner gives a Bot its HAB address and an agent its own token, which acts as that Bot", async ({ page, request }) => {
	const id = unique();
	const name = `Lab ${id}`;
	const address = `lab-${id}@hermes.hab`;
	await tool(request, "create_card", { bot: "Scout", title: `seed ${id}` });
	await signIn(page);
	await page.getByRole("button", { name: /Bots & MCP/ }).click();
	const panel = page.getByRole("dialog", { name: "Bots & MCP" });
	await panel.getByRole("tab", { name: "Roster" }).click();

	await panel.getByRole("button", { name: "Add bot" }).click();
	const form = panel.getByRole("form", { name: "New bot" });
	await form.getByLabel("Name").fill(name);
	await form.getByLabel("HAB address").fill(address);
	await form.getByRole("button", { name: "Save" }).click();
	await expect(panel.getByText(address)).toBeVisible();

	await panel.getByRole("tab", { name: "Connections" }).click();
	await panel.getByRole("button", { name: "New connection" }).click();
	const link = panel.getByRole("form", { name: "New connection" });
	await link.getByLabel("Name").fill(`Hermes ${id}`);
	await link.getByRole("checkbox", { name: address }).click();
	await link.getByRole("button", { name: "Create and show token" }).click();

	const issued = panel.getByRole("status").filter({ hasText: `Token for Hermes ${id}` });
	await expect(issued).toBeVisible();
	const token = (await issued.locator("pre").textContent())!.trim();
	expect(token).toMatch(/^habk_/);
	// The setup snippets fill in the token while it is on screen.
	await panel.getByRole("tab", { name: "Claude Code" }).click();
	await expect(panel.getByText(`Authorization: Bearer ${token}`)).toBeVisible();

	const title = `from hermes ${id}`;
	const card = await tool(request, "create_card", { title, habTask: `task-${id}` }, token);
	expect(card.card.createdBy).toBe(name);
	await panel.getByRole("button", { name: "Close" }).click();
	await page.reload();
	// Long HAB ids show their end on the card and the whole id on hover.
	await expect(cardTitled(page, title).getByTitle(`HAB Task task-${id}`)).toHaveText(`Task …k-${id}`);

	// Revoking stops the token at once.
	await page.getByRole("button", { name: /Bots & MCP/ }).click();
	await panel.getByRole("tab", { name: "Connections" }).click();
	await panel.locator("div", { hasText: `Hermes ${id}` }).getByRole("button", { name: "Revoke" }).last().click();
	await page.getByRole("alertdialog").getByRole("button", { name: "Revoke" }).click();
	await expect(panel.getByText(`Hermes ${id}`)).toHaveCount(0);
	const refused = await request.post("/api/mcp", {
		headers: { Authorization: `Bearer ${token}` },
		data: { jsonrpc: "2.0", id: 1, method: "tools/list" },
	});
	expect(refused.status()).toBe(401);
});
