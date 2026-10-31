# 引き継ぎ（2026-10-30）

hab-kanban は、エージェント全体（Grok Bot、Dots、Hermes、Claude Code、Codex）の仕事を扱うカンバンです。HAB（hiraoku-agent-base）の Agent Hub のタスクは扱いません。HAB 側の位置づけは [hiraoku-agent-base#15](https://github.com/s-hiraoku/hiraoku-agent-base/issues/15) にあります。

## 現状

- grokbot-kanban を移植済みです。カード、bot ロスター、メモ、Run、Cursor への引き渡し、MCP（15 ツール）、GitHub でのオーナーログインがあります。
- スタックは Next.js 16.4、React 19.3、zod 4、TypeScript 6、Vitest 5、drizzle-orm、Tailwind 4 です。Node は 24 以上が必要です。
- 動作環境は Cloudflare Workers です。OpenNext（`@opennextjs/cloudflare`）で動かし、DB は D1（binding `DB`、DB 名 `hab-kanban`、APAC）を使います。
- 本番は https://hab-kanban.s-hiraoku.workers.dev です。次のデプロイから https://hab-kanban.hiraoku.dev でも配信します。`main` への push では自動デプロイされません。デプロイは `npm run deploy` で行います。
- 本番で確認済みのこと
  - オーナーの GitHub ログインとボードの表示
  - MCP：トークンなしは 401、`tools/list` は 15 件、`board_summary` が動く
- secret は `OWNER_GITHUB_LOGIN`、`GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET` の 3 つと、移行期間だけ残す `BOT_TOKEN` です。`wrangler secret put` で登録済みで、値はリポジトリにありません。エージェントのトークンは secret ではなく、ボードの Connections タブで発行します（D1 にはハッシュだけを保存します）。
- `npm run lint`、`npm run typecheck`、`npm test`（61 件）、`npm run test:e2e`（32 件）、`next build`、OpenNext の build はすべて通ります。

## 構成で押さえること

- `lib/runtime.ts`：`getCloudflareContext().env.DB` から、リクエストごとに drizzle（`drizzle-orm/d1`）を開きます。Run の途中で持ち越す状態は、カードに保存した state に入っています。
- `lib/db.ts`：`Db` 型と `isUniqueViolation`（SQLite の UNIQUE 違反を cause の連鎖まで見て判定する）があります。
- スキーマは `lib/schema.ts`（sqliteTable）と `migrations/*.sql` です。スキーマを変えるときは、新しい番号の SQL を `migrations/` に足してください。
  - ローカルへの適用は `npm run db:migrate:local`、本番への適用は `npm run db:migrate` です。
- テストは `tests/sqlite.ts` で、`node:sqlite` のメモリ DB に同じ migrations を当てて走ります（`drizzle-orm/sqlite-proxy` 経由）。
- MCP の入力スキーマは `lib/mcp.ts` の `jsonSchemaOf` が作ります（`z.toJSONSchema`）。zod の内部 API には戻さないでください。以前、それで入力スキーマが黙って空になりました。`tests/mcp.test.ts` に回帰テストがあります。
- ローカル開発の手順は次のとおりです。
  1. `.dev.vars.example` を `.dev.vars` にコピーして値を入れる
  2. `npm run db:migrate:local`
  3. `npm run dev`
  - `next dev` には OpenNext 経由でローカル D1 が付きます。

## 残作業

2026-10-30 に、前回の残作業 1〜3 と、HAB 向けの作り直しを終えました。

- e2e は Workers の上（OpenNext の build と `wrangler dev`、毎回空のローカル D1）で動き、CI でも走ります（`e2e/serve.mjs`）。
- lint の warning を解消し、React Compiler 系のルールを error に戻しました。
- 画面名を HAB Kanban に変えました。Voice カードと「by Grok」のスクリーニングは削除しました（`migrations/0002_hab_refs.sql`）。
- カードは HAB の Task と Relay メッセージを ID で指せます（`habTask`、`habMessage`）。表示するだけで、HAB の DB は読み書きしません。
- ロスターの Bot は HAB アドレス（`lab@hermes.hab`）を持てます。エージェントは接続（HAB の参加グループに当たる）ごとのトークンで入り、その接続の Bot としてだけ動けます（`migrations/0003_hab_connections.sql`）。
- 独自ドメインは hab-kanban.hiraoku.dev です（`wrangler.jsonc` の `routes`）。

### 1. 本番への反映（オーナーの作業）

1. hiraoku.dev が同じ Cloudflare アカウントのゾーンにあることを確かめる。
2. GitHub OAuth アプリの callback URL を `https://hab-kanban.hiraoku.dev/api/auth/github/callback` に変える。
3. `npm run db:migrate` を実行してから、`npm run deploy` を実行する。
4. 移行の手順は README の「Moving off the shared token」に従う。各 Bot に HAB アドレスを付けて接続を発行し、エージェントの設定を新しいトークンに切り替える。全員が移ったら `npx wrangler secret delete BOT_TOKEN` を実行する。

### 2. まだ決まっていない論点

- Dots と Hermes の MCP クライアントで、ヘッダー付きの Streamable HTTP をそのまま使えるかは未確認です。Connections タブの「Hermes, Dots, others」の設定例が合わなければ、各クライアントの形式に合わせて足してください。
- カードと HAB の Task・Relay を、表示より先まで結び付けるか（状態の同期、Relay からの起票など）。結び付けるなら HAB の Relay か Task の契約を通し、Hub の DB は直接触らないでください。
- HAB 側の認証（Auth0、Relay の登録台帳）が本番に入ったら、このボード独自のトークンを HAB 発行のものに置き換えるか。

## 守ること

- このリポジトリは公開です。secret、トークン、個人的な文脈を commit しないでください。`.dev.vars` は gitignore 済みです。
- カードの移動、MCP 呼び出し、イベントの再送は冪等にしてください（`externalId`、`state_version`）。
- 外部から来るコメントは信頼できない入力として扱ってください。コメントだけで何かを自動実行してはいけません。
- 作業は `main` で行います。ライブラリのバージョンは記憶に頼らず、`npm view` で最新を確認してから固定してください。
