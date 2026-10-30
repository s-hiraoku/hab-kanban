-- Bots carry their HAB address (bot@agent.hab), and each agent connects with a token of its own.
-- A connection is HAB's participant group: its token may act as the Bots listed in members, and nothing
-- else. Only the token's SHA-256 hash is kept, as for sessions.
ALTER TABLE bots ADD COLUMN address text;
CREATE UNIQUE INDEX bots_address ON bots (address) WHERE address IS NOT NULL;

CREATE TABLE connections (
  id text PRIMARY KEY,
  name text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  members text NOT NULL DEFAULT '[]',
  created_at integer NOT NULL,
  last_used_at integer
);
