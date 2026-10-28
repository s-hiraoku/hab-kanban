import { describe, expect, it } from "vitest";
import { COLUMNS, groupByColumn, type Card } from "../src/domain/card.ts";

const card = (id: string, column: Card["column"]): Card => ({
  id,
  externalId: null,
  title: id,
  body: "",
  column,
  priority: "normal",
  assignees: [],
  createdBy: "owner",
  createdAt: 0,
});

describe("groupByColumn", () => {
  it("returns every column, even when empty", () => {
    const groups = groupByColumn([]);
    expect(Object.keys(groups)).toEqual(COLUMNS.map((c) => c.id));
  });

  it("places cards in their column in order", () => {
    const groups = groupByColumn([
      card("a", "todo"),
      card("b", "todo"),
      card("c", "done"),
    ]);
    expect(groups.todo.map((c) => c.id)).toEqual(["a", "b"]);
    expect(groups.done.map((c) => c.id)).toEqual(["c"]);
  });
});
