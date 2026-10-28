export const COLUMNS = [
  { id: "inbox", label: "Inbox" },
  { id: "todo", label: "Todo" },
  { id: "inProgress", label: "In Progress" },
  { id: "inReview", label: "In Review" },
  { id: "done", label: "Done" },
  { id: "wontDo", label: "Won't Do" },
] as const;

export type ColumnId = (typeof COLUMNS)[number]["id"];

export type Priority = "low" | "normal" | "high";

/** An agent id from the roster (Grok Bot, Dots, Hermes, Claude Code, ...) or "owner". */
export type MemberId = string;

/** A unit of work for the agents. hab-kanban owns this state; the HAB Hub does not. */
export interface Card {
  id: string;
  /** Idempotency key: a retried create with the same key returns the same card. */
  externalId: string | null;
  title: string;
  body: string;
  column: ColumnId;
  priority: Priority;
  assignees: readonly MemberId[];
  createdBy: MemberId;
  createdAt: number;
}

export function groupByColumn(
  cards: readonly Card[],
): Record<ColumnId, Card[]> {
  const groups = Object.fromEntries(
    COLUMNS.map((c) => [c.id, [] as Card[]]),
  ) as Record<ColumnId, Card[]>;
  for (const card of cards) groups[card.column].push(card);
  return groups;
}
