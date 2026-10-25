-- Agent state is independent of the editorial Workspace JSON and Studio rows.
-- Tokens are stored only as SHA-256 digests; no provider credentials are stored.
CREATE TABLE IF NOT EXISTS marker_agent_connections(id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, updated_at TEXT NOT NULL, document TEXT NOT NULL CHECK(json_valid(document)));
CREATE TABLE IF NOT EXISTS marker_agent_sessions(id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'open', updated_at TEXT NOT NULL, document TEXT NOT NULL CHECK(json_valid(document)));
CREATE TABLE IF NOT EXISTS marker_agent_runs(id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, updated_at TEXT NOT NULL, document TEXT NOT NULL CHECK(json_valid(document)));
CREATE INDEX IF NOT EXISTS marker_agent_runs_status ON marker_agent_runs(status,updated_at);
CREATE INDEX IF NOT EXISTS marker_agent_runs_session ON marker_agent_runs(json_extract(document,'$.sessionId'));
CREATE TABLE IF NOT EXISTS marker_agent_proposals(id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, updated_at TEXT NOT NULL, document TEXT NOT NULL CHECK(json_valid(document)));
CREATE INDEX IF NOT EXISTS marker_agent_proposals_session ON marker_agent_proposals(json_extract(document,'$.sessionId'));
CREATE TABLE IF NOT EXISTS marker_agent_events(id TEXT PRIMARY KEY,run_id TEXT NOT NULL,session_id TEXT NOT NULL,created_at TEXT NOT NULL,document TEXT NOT NULL CHECK(json_valid(document)));
CREATE INDEX IF NOT EXISTS marker_agent_events_session ON marker_agent_events(session_id,created_at);
CREATE TABLE IF NOT EXISTS marker_agent_meta(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL DEFAULT 0,document TEXT NOT NULL CHECK(json_valid(document)));
INSERT OR IGNORE INTO marker_agent_meta(id,document) VALUES(1,'{"dailyRuns":30,"maxRunSeconds":300,"maxConcurrentRuns":1,"retentionDays":30}');
