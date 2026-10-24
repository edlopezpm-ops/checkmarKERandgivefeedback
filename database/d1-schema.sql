-- Schema only, reconstructed in an empty in-memory SQLite database. No data or INSERT statements.
PRAGMA foreign_keys=ON;

CREATE TABLE marker_auth_challenges (
  challenge_hash TEXT PRIMARY KEY CHECK (length(challenge_hash) = 64),
  owner_hash TEXT NOT NULL CHECK (length(owner_hash) = 64),
  code_hash TEXT NOT NULL CHECK (length(code_hash) = 64),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at = created_at + 300),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  consumed_at INTEGER
) WITHOUT ROWID;

CREATE TABLE marker_auth_limits (
  key TEXT PRIMARY KEY CHECK (length(key) = 64),
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL CHECK (count > 0 AND count <= 100),
  last_at INTEGER NOT NULL,
  ticket TEXT NOT NULL CHECK (length(ticket) = 64)
) WITHOUT ROWID;

CREATE TABLE marker_auth_sessions (
  session_hash TEXT PRIMARY KEY CHECK (length(session_hash) = 64),
  owner_hash TEXT NOT NULL CHECK (length(owner_hash) = 64),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at = created_at + 21600),
  last_seen INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE marker_studio_analysis (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES marker_studio_assets(id) ON DELETE RESTRICT,
  sha256 TEXT NOT NULL CHECK(length(sha256)=64),
  start_ms INTEGER NOT NULL CHECK(start_ms>=0),
  end_ms INTEGER NOT NULL CHECK(end_ms>start_ms AND end_ms-start_ms<=120000),
  profile TEXT NOT NULL,
  tool_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('queued','running','completed','failed')),
  document TEXT NOT NULL CHECK(json_valid(document)),
  lock_token TEXT,
  lock_until INTEGER NOT NULL DEFAULT 0,
  reserved_bytes INTEGER NOT NULL DEFAULT 0 CHECK(reserved_bytes>=0),
  metadata_reserved INTEGER NOT NULL DEFAULT 0 CHECK(metadata_reserved>=0)
);

CREATE TABLE marker_studio_assets (
  id TEXT PRIMARY KEY,
  sha256 TEXT NOT NULL CHECK(length(sha256)=64),
  kind TEXT NOT NULL CHECK(kind IN ('video','image','audio')),
  size_bytes INTEGER NOT NULL CHECK(size_bytes BETWEEN 1 AND 262144000),
  storage_key TEXT NOT NULL UNIQUE,
  document TEXT NOT NULL CHECK(json_valid(document))
);

CREATE TABLE marker_studio_campaigns (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  document TEXT NOT NULL CHECK(json_valid(document))
);

CREATE TABLE marker_studio_compute (
  month TEXT PRIMARY KEY CHECK(length(month)=7),
  used_cents INTEGER NOT NULL DEFAULT 0 CHECK(used_cents>=0),
  last_token TEXT
);

CREATE TABLE marker_studio_jobs (
  id TEXT PRIMARY KEY,
  variant_id TEXT NOT NULL REFERENCES marker_studio_variants(id) ON DELETE RESTRICT,
  recipe_revision INTEGER NOT NULL CHECK(recipe_revision>0),
  status TEXT NOT NULL CHECK(status IN ('queued','running','completed','failed')),
  document TEXT NOT NULL CHECK(json_valid(document))
, lock_token TEXT, lock_until INTEGER NOT NULL DEFAULT 0, reserved_bytes INTEGER NOT NULL DEFAULT 0 CHECK(reserved_bytes>=0));

CREATE TABLE marker_studio_limits (
  id INTEGER PRIMARY KEY CHECK(id=1),
  stored_bytes INTEGER NOT NULL DEFAULT 0 CHECK(stored_bytes>=0),
  reserved_bytes INTEGER NOT NULL DEFAULT 0 CHECK(reserved_bytes>=0),
  upload_token TEXT,
  compute_token TEXT,
  compute_until INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE marker_studio_materials (
  id TEXT PRIMARY KEY,
  asset_id TEXT REFERENCES marker_studio_assets(id) ON DELETE RESTRICT,
  content_version INTEGER NOT NULL CHECK(content_version>0),
  document TEXT NOT NULL CHECK(json_valid(document))
);

CREATE TABLE marker_studio_meta (
  id INTEGER PRIMARY KEY CHECK(id=1),
  revision INTEGER NOT NULL CHECK(revision>=0)
, write_token TEXT);

CREATE TABLE marker_studio_settings (
  id INTEGER PRIMARY KEY CHECK(id=1),
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
  monthly_budget_cents INTEGER NOT NULL DEFAULT 2000 CHECK(monthly_budget_cents BETWEEN 0 AND 2000),
  processing_budget_cents INTEGER NOT NULL DEFAULT 1000 CHECK(processing_budget_cents BETWEEN 0 AND 2000),
  ai_budget_cents INTEGER NOT NULL DEFAULT 0 CHECK(ai_budget_cents BETWEEN 0 AND 2000),
  storage_limit_bytes INTEGER NOT NULL DEFAULT 2147483648 CHECK(storage_limit_bytes BETWEEN 0 AND 2147483648),
  default_duration_seconds INTEGER NOT NULL DEFAULT 20 CHECK(default_duration_seconds BETWEEN 5 AND 60),
  CHECK(processing_budget_cents+ai_budget_cents<=monthly_budget_cents)
);

CREATE TABLE marker_studio_uploads (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK(status IN ('uploading','completed','cancelled')),
  document TEXT NOT NULL CHECK(json_valid(document))
, lock_token TEXT, lock_until INTEGER NOT NULL DEFAULT 0);

CREATE TABLE marker_studio_variants (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES marker_studio_campaigns(id) ON DELETE RESTRICT,
  recipe_revision INTEGER NOT NULL CHECK(recipe_revision>0),
  document TEXT NOT NULL CHECK(json_valid(document))
);

CREATE TABLE marker_workspace (id INTEGER PRIMARY KEY CHECK(id = 1), revision INTEGER NOT NULL CHECK(revision > 0), document TEXT NOT NULL CHECK(length(CAST(document AS BLOB)) <= 1048576 AND json_valid(document)));

CREATE INDEX marker_studio_analysis_asset ON marker_studio_analysis(asset_id);

CREATE UNIQUE INDEX marker_studio_analysis_cache ON marker_studio_analysis(sha256,start_ms,end_ms,profile,tool_version) WHERE status!='failed';

CREATE INDEX marker_studio_analysis_status ON marker_studio_analysis(status);

CREATE INDEX marker_studio_assets_hash ON marker_studio_assets(sha256);

CREATE INDEX marker_studio_jobs_recipe ON marker_studio_jobs(variant_id,recipe_revision);

CREATE UNIQUE INDEX marker_studio_one_render ON marker_studio_jobs((1)) WHERE status IN ('queued','running');

CREATE UNIQUE INDEX marker_studio_one_upload ON marker_studio_uploads(status) WHERE status='uploading';

CREATE INDEX marker_studio_variants_campaign ON marker_studio_variants(campaign_id);
