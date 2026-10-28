import { COLUMNS, groupByColumn } from "../domain/columns.ts";
import type { HubTask } from "../domain/hub.ts";

// Placeholder data until the Hub client lands. The Hub is the source of truth.
const SAMPLE: HubTask[] = [
  {
    id: "t-1",
    taskType: "connectivity_check",
    owner: "dots",
    destination: "hermes",
    state: "queued",
    result: null,
    at: 0,
  },
  {
    id: "t-2",
    taskType: "shift_log_inventory",
    owner: "dots",
    destination: "hermes",
    state: "running",
    result: null,
    at: 0,
  },
];

export function Board() {
  const groups = groupByColumn(SAMPLE);
  return (
    <main className="min-h-screen bg-neutral-950 p-4 text-neutral-100">
      <h1 className="mb-4 text-lg font-semibold">HAB Kanban</h1>
      <div className="grid gap-3 md:grid-cols-5">
        {COLUMNS.map((column) => (
          <section key={column.id} className="rounded-lg bg-neutral-900 p-3">
            <h2 className="mb-2 text-sm text-neutral-400">{column.label}</h2>
            <ul className="space-y-2">
              {groups[column.id].map((task) => (
                <li
                  key={task.id}
                  className="rounded bg-neutral-800 p-2 text-sm"
                >
                  <div className="font-medium">{task.taskType}</div>
                  <div className="text-xs text-neutral-400">
                    {task.id} · {task.owner} → {task.destination}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
