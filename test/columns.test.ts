import { describe, expect, it } from "vitest";
import { columnOf, groupByColumn } from "../src/domain/columns.ts";
import { HUB_STATES, type HubTask } from "../src/domain/hub.ts";

const task = (id: string, state: HubTask["state"]): HubTask => ({
  id,
  taskType: "connectivity_check",
  owner: "dots",
  destination: "hermes",
  state,
  result: null,
  at: 0,
});

describe("columns", () => {
  it("maps every Hub state to a column", () => {
    for (const state of HUB_STATES) expect(() => columnOf(state)).not.toThrow();
  });

  it("puts failed and cancelled together in Stopped", () => {
    expect(columnOf("failed")).toBe("stopped");
    expect(columnOf("cancelled")).toBe("stopped");
  });

  it("groups tasks by column", () => {
    const groups = groupByColumn([task("a", "queued"), task("b", "running")]);
    expect(groups.todo.map((t) => t.id)).toEqual(["a"]);
    expect(groups.inProgress.map((t) => t.id)).toEqual(["b"]);
  });
});
