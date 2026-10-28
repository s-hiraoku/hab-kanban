/** Task states exactly as the HAB Hub reports them (hiraoku-agent-base src/types.ts). */
export const HUB_STATES = [
  "queued",
  "running",
  "waiting_approval",
  "succeeded",
  "failed",
  "cancelled",
] as const;
export type HubState = (typeof HUB_STATES)[number];

/** Read-only projection of a Hub task. The Hub stays the source of truth. */
export interface HubTask {
  id: string;
  taskType: string;
  owner: string;
  destination: string;
  state: HubState;
  result: string | null;
  at: number;
}
