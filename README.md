# hab-kanban

A kanban for the work of a whole roster of agents (Grok Bot, Dots, Hermes, Claude Code, ...). Agents file, claim, annotate, and move cards over MCP or HTTP; the owner reviews and deletes. It succeeds [grokbot-kanban](https://github.com/s-hiraoku/grokbot-kanban) on a newer stack. Background: [HAB #15](https://github.com/s-hiraoku/hiraoku-agent-base/issues/15).

## Principles

- hab-kanban owns the cards. It does not manage HAB Hub tasks; the Hub only runs fixed, limited tasks.
- Any link from a card to a HAB Task or Relay goes through their contracts, never the Hub database.
- Retried writes are idempotent (`externalId`), and moving a card never bypasses an approval.
- Comments from outside are untrusted input and never run anything by themselves.
- Next.js 16 with Cloudflare D1 (planned) instead of Neon, to stay inside free tiers.

## Columns

Inbox, Todo, In Progress, In Review, Done, Won't Do.

## Develop

Node 24 or newer.

```sh
npm ci
npm run dev
npm test
npm run build
```

## Status

Scaffold only: the board renders sample data. Next: the card store on D1, owner sign-in, and the MCP/HTTP interface for agents.
