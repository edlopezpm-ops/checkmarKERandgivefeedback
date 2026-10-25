-- Private single-owner authentication only; no research counters or raw identities.
CREATE TABLE IF NOT EXISTS marker_auth_limits (
  key TEXT PRIMARY KEY CHECK (length(key) = 64),
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL CHECK (count > 0 AND count <= 100),
  last_at INTEGER NOT NULL,
  ticket TEXT NOT NULL CHECK (length(ticket) = 64)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS marker_auth_challenges (
  challenge_hash TEXT PRIMARY KEY CHECK (length(challenge_hash) = 64),
  owner_hash TEXT NOT NULL CHECK (length(owner_hash) = 64),
  code_hash TEXT NOT NULL CHECK (length(code_hash) = 64),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at = created_at + 300),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  consumed_at INTEGER
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS marker_auth_sessions (
  session_hash TEXT PRIMARY KEY CHECK (length(session_hash) = 64),
  owner_hash TEXT NOT NULL CHECK (length(owner_hash) = 64),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at = created_at + 21600),
  last_seen INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE marker_workspace (id INTEGER PRIMARY KEY CHECK(id = 1), revision INTEGER NOT NULL CHECK(revision > 0), document TEXT NOT NULL CHECK(length(CAST(document AS BLOB)) <= 1048576 AND json_valid(document)));
