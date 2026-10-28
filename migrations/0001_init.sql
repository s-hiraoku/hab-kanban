-- The whole board schema for SQLite and Cloudflare D1. Times are Unix milliseconds; JSON columns hold text.
CREATE TABLE IF NOT EXISTS cards (
  id text PRIMARY KEY,
  created_at integer NOT NULL,
  external_id text UNIQUE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  repo text,
  source text,
  original_link text,
  priority text NOT NULL DEFAULT 'normal',
  kind text NOT NULL,
  screening text,
  assignees text NOT NULL DEFAULT '[]',
  created_by text,
  rank text NOT NULL,
  state text NOT NULL,
  state_version integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS cards_rank ON cards (rank, id);

CREATE TABLE IF NOT EXISTS bots (
  id text PRIMARY KEY,
  name text NOT NULL,
  role text NOT NULL DEFAULT '',
  avatar text,
  color text NOT NULL,
  created_at integer NOT NULL,
  last_seen_at integer
);

CREATE UNIQUE INDEX IF NOT EXISTS bots_name ON bots (lower(name));

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  github_id integer NOT NULL,
  login text NOT NULL,
  name text,
  avatar_url text,
  created_at integer NOT NULL,
  last_sign_in_at integer NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS users_github_id ON users (github_id);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at integer NOT NULL,
  expires_at integer NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions (user_id);
