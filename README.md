# hab-kanban

A thin, read-only kanban UI over the [HAB (Hiraoku Agent Base)](https://github.com/s-hiraoku/hiraoku-agent-base) Hub. Design background: [HAB #15](https://github.com/s-hiraoku/hiraoku-agent-base/issues/15).

## Principles

- The Hub is the source of truth. This app has no task database of its own.
- No approval boundary is bypassed by moving a card.
- The UI is a Next.js 16 app with no database, so it fits free hosting tiers (Cloudflare via OpenNext, or Vercel).

## Columns

| Column      | Hub state(s)          |
| ----------- | --------------------- |
| Todo        | `queued`              |
| In Progress | `running`             |
| Review      | `waiting_approval`    |
| Done        | `succeeded`           |
| Stopped     | `failed`, `cancelled` |

## Develop

Node 24 or newer.

```sh
npm ci
npm run dev
npm test
npm run build
```

## Status

Scaffold only: the board renders sample data. Next: a Hub client (`get` plus `task.terminal` events). Listing tasks needs a read-only list tool on the Hub side.
