# 引き継ぎ（2026-10-29）

hab-kanban は、エージェント全体（Grok Bot、Dots、Hermes、Claude Code、Codex）の仕事を扱うカンバンです。HAB（hiraoku-agent-base）の Agent Hub のタスクは扱いません。HAB 側の位置づけは [hiraoku-agent-base#15](https://github.com/s-hiraoku/hiraoku-agent-base/issues/15) にあります。

## 現状

- grokbot-kanban を移植済みです。カード、bot ロスター、メモ、Run、Cursor への引き渡し、MCP（15 ツール）、GitHub でのオーナーログインがあります。
- スタックは Next.js 16.4、React 19.3、zod 4、TypeScript 6、Vitest 5、drizzle-orm、Tailwind 4 です。Node は 24 以上が必要です。
- 動作環境は Cloudflare Workers です。OpenNext（`@opennextjs/cloudflare`）で動かし、DB は D1（binding `DB`、DB 名 `hab-kanban`、APAC）を使います。
- 本番は https://hab-kanban.s-hiraoku.workers.dev です。`main` への push では自動デプロイされません。デプロイは `npm run deploy` で行います。
- 本番で確認済みのこと
  - オーナーの GitHub ログインとボードの表示
  - MCP：トークンなしは 401、`tools/list` は 15 件、`board_summary` が動く
- secret は `BOT_TOKEN`、`OWNER_GITHUB_LOGIN`、`GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET` の 4 つです。`wrangler secret put` で登録済みで、値はリポジトリにありません。
- `npm run lint`（エラー 0）、`npm run typecheck`、`npm test`（55 件）、`next build`、OpenNext の build はすべて通ります。CI も成功しています。

## 構成で押さえること

- `lib/runtime.ts`：`getCloudflareContext().env.DB` から、リクエストごとに drizzle（`drizzle-orm/d1`）を開きます。Run の途中で持ち越す状態は、カードに保存した state に入っています。
- `lib/db.ts`：`Db` 型と `isUniqueViolation`（SQLite の UNIQUE 違反を cause の連鎖まで見て判定する）があります。
- スキーマは `lib/schema.ts`（sqliteTable）と `migrations/*.sql` です。スキーマを変えるときは、新しい番号の SQL を `migrations/` に足してください。
  - ローカルへの適用は `npm run db:migrate:local`、本番への適用は `npm run db:migrate` です。
- テストは `tests/sqlite.ts` で、`node:sqlite` のメモリ DB に同じ migrations を当てて走ります（`drizzle-orm/sqlite-proxy` 経由）。
- MCP の入力スキーマは `lib/mcp.ts` の `jsonSchemaOf` が作ります（`z.toJSONSchema`）。zod の内部 API には戻さないでください。以前、それで入力スキーマが黙って空になりました。`tests/grok.test.ts` に回帰テストがあります。
- ローカル開発の手順は次のとおりです。
  1. `.dev.vars.example` を `.dev.vars` にコピーして値を入れる
  2. `npm run db:migrate:local`
  3. `npm run dev`
  - `next dev` には OpenNext 経由でローカル D1 が付きます。

## 残作業

### 1. Playwright e2e を Workers の上で動かす

`playwright.config.ts` は今も `next build && next start` を起動しています。この方法では D1 の binding がないため、e2e は動きません。

- `npm run preview`（`opennextjs-cloudflare build && preview`）か、`wrangler dev` で起動する形に変えてください。テスト用 D1 には migrations を当てる必要があります。
- `e2e/fake-github.mjs` と `e2e/fake-cursor.mjs` は、`GITHUB_WEB_URL`、`GITHUB_API_URL`、`CURSOR_API_URL` で差し込みます。Worker にも渡るようにしてください（`.dev.vars` か `--var`）。
- テストごとに DB を初期化する方法を決めてください。以前はメモリ DB でしたが、今は永続化されるローカル D1 です。
- 動くようになったら、CI（`.github/workflows/ci.yml`）にも e2e を追加してください。

### 2. lint の warning を解消して、ルールを error に戻す

`eslint.config.mjs` で、React Compiler 系のルール 5 つ（`purity`、`refs`、`set-state-in-effect`、`immutability`、`preserve-manual-memoization`）を一時的に warn に下げています。

主な箇所は次のとおりです。
- `components/Board.tsx`：9 件。set-state-in-effect、refs、immutability、purity、preserve-manual-memoization です。ほかに exhaustive-deps が 1 件、no-location-assign-relative-destination が 2 件あります。
- `components/BotsPanel.tsx`、`components/ConfirmDialog.tsx`：set-state-in-effect
- `components/CreatedAt.tsx`、`app/page.tsx`、`app/login/page.tsx`：purity（描画中の `Date.now()` など）
- その他の小さなもの
  - `components/Avatar.tsx`：no-img-element
  - 未使用変数：`lib/http.ts`、`lib/mcp.ts`、`tests/cursor.test.ts`、`tests/kit.ts`
  - `eslint.config.mjs`：無名の default export

直し終わったら、下げた 5 つのルールを error に戻してください。

### 3. エージェントごとのトークン

今は全エージェントが共有の `BOT_TOKEN` を使い、`bot` 引数で名乗ります。そのため、なりすましを防げません。エージェントごとにトークンを発行して照合し、`bot` をトークンから決める形にしてください。
- 実装の候補は、D1 にトークンのハッシュを保存して、ロスターの bot と結び付ける方法です。
- 既存の MCP クライアントが動き続けるように、移行の手順も用意してください。

### 4. まだ決まっていない論点（実装の前に、オーナーに確認する）

- 連携するエージェントの範囲：Grok Bot 以外の MCP クライアントの設定
- カードの実行を HAB の Task や Relay と結び付けるか、結び付けるならどこを境界にするか。結び付ける場合でも、Relay か Task の契約を通してください。HAB の Hub の DB を直接読み書きしてはいけません。
- カードに表示する最小限の項目と、UI の構成

## 守ること

- このリポジトリは公開です。secret、トークン、個人的な文脈を commit しないでください。`.dev.vars` は gitignore 済みです。
- カードの移動、MCP 呼び出し、イベントの再送は冪等にしてください（`externalId`、`state_version`）。
- 外部から来るコメントは信頼できない入力として扱ってください。コメントだけで何かを自動実行してはいけません。
- 作業は `main` で行います。ライブラリのバージョンは記憶に頼らず、`npm view` で最新を確認してから固定してください。
