import type { HubState, HubTask } from "./hub.ts";

export const COLUMNS = [
  { id: "todo", label: "Todo", states: ["queued"] },
  { id: "inProgress", label: "In Progress", states: ["running"] },
  { id: "review", label: "Review", states: ["waiting_approval"] },
  { id: "done", label: "Done", states: ["succeeded"] },
  { id: "stopped", label: "Stopped", states: ["failed", "cancelled"] },
] as const satisfies readonly {
  id: string;
  label: string;
  states: readonly HubState[];
}[];

export type ColumnId = (typeof COLUMNS)[number]["id"];

export function columnOf(state: HubState): ColumnId {
  const column = COLUMNS.find((c) =>
    (c.states as readonly HubState[]).includes(state),
  );
  if (!column) throw new Error(`unmapped hub state: ${state}`);
  return column.id;
}

export function groupByColumn(
  tasks: readonly HubTask[],
): Record<ColumnId, HubTask[]> {
  const groups: Record<ColumnId, HubTask[]> = {
    todo: [],
    inProgress: [],
    review: [],
    done: [],
    stopped: [],
  };
  for (const task of tasks) groups[columnOf(task.state)].push(task);
  return groups;
}
