import { COLUMNS, groupByColumn, type Card } from "../domain/card.ts";

// Placeholder data until the store lands.
const SAMPLE: Card[] = [
  {
    id: "c-1",
    externalId: null,
    title: "Review weekly digest",
    body: "",
    column: "todo",
    priority: "normal",
    assignees: ["grok-bot"],
    createdBy: "owner",
    createdAt: 0,
  },
  {
    id: "c-2",
    externalId: null,
    title: "Fix flaky e2e",
    body: "",
    column: "inProgress",
    priority: "high",
    assignees: ["claude-code"],
    createdBy: "owner",
    createdAt: 0,
  },
];

export function Board() {
  const groups = groupByColumn(SAMPLE);
  return (
    <main className="min-h-screen bg-neutral-950 p-4 text-neutral-100">
      <h1 className="mb-4 text-lg font-semibold">HAB Kanban</h1>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {COLUMNS.map((column) => (
          <section key={column.id} className="rounded-lg bg-neutral-900 p-3">
            <h2 className="mb-2 text-sm text-neutral-400">{column.label}</h2>
            <ul className="space-y-2">
              {groups[column.id].map((card) => (
                <li
                  key={card.id}
                  className="rounded bg-neutral-800 p-2 text-sm"
                >
                  <div className="font-medium">{card.title}</div>
                  <div className="text-xs text-neutral-400">
                    {card.assignees.join(", ") || "Unassigned"}
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
