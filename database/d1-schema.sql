-- Schema only, reconstructed in an empty in-memory SQLite database. No data or INSERT statements.
PRAGMA foreign_keys=ON;

CREATE TABLE marker_account_lifecycle (
  id INTEGER PRIMARY KEY CHECK(id=1),
  status TEXT NOT NULL CHECK(status IN ('active','deleting','deleted')),
  phase TEXT NOT NULL CHECK(phase IN ('active','processor','waiting','uploads','media','database','done')),
  capability_hash TEXT CHECK(capability_hash IS NULL OR length(capability_hash)=64),
  lease_token TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  deleted_objects INTEGER NOT NULL DEFAULT 0 CHECK(deleted_objects>=0),
  needs_retry INTEGER NOT NULL DEFAULT 0 CHECK(needs_retry IN (0,1))
);

CREATE TABLE marker_agent_connections(id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, updated_at TEXT NOT NULL, document TEXT NOT NULL CHECK(json_valid(document)));

CREATE TABLE marker_agent_events(id TEXT PRIMARY KEY,run_id TEXT NOT NULL,session_id TEXT NOT NULL,created_at TEXT NOT NULL,document TEXT NOT NULL CHECK(json_valid(document)));

CREATE TABLE marker_agent_meta(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL DEFAULT 0,document TEXT NOT NULL CHECK(json_valid(document)));

CREATE TABLE marker_agent_proposals(id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, updated_at TEXT NOT NULL, document TEXT NOT NULL CHECK(json_valid(document)));

CREATE TABLE marker_agent_runs(id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, updated_at TEXT NOT NULL, document TEXT NOT NULL CHECK(json_valid(document)));

CREATE TABLE marker_agent_sessions(id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'open', updated_at TEXT NOT NULL, document TEXT NOT NULL CHECK(json_valid(document)));

CREATE TABLE marker_analytics_subject (
  id INTEGER PRIMARY KEY CHECK(id=1),
  subject_ref TEXT NOT NULL CHECK(length(subject_ref)=64),
  delete_receipt_id TEXT CHECK(delete_receipt_id IS NULL OR length(delete_receipt_id)<=96)
);

CREATE TABLE marker_auth_challenges (
  challenge_hash TEXT PRIMARY KEY CHECK (length(challenge_hash) = 64),
  owner_hash TEXT NOT NULL CHECK (length(owner_hash) = 64),
  code_hash TEXT NOT NULL CHECK (length(code_hash) = 64),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at = created_at + 300),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  consumed_at INTEGER
) WITHOUT ROWID;

CREATE TABLE "marker_auth_identities" (
  issuer TEXT NOT NULL CHECK(issuer IN ('https://accounts.google.com','https://github.com')),
  subject_hash TEXT NOT NULL CHECK(length(subject_hash)=64),
  tenant_id TEXT NOT NULL REFERENCES marker_auth_operator(tenant_id),
  user_id TEXT NOT NULL REFERENCES marker_auth_operator(user_id),
  linked_at INTEGER NOT NULL,
  PRIMARY KEY(issuer,subject_hash), UNIQUE(tenant_id,user_id,issuer)
) WITHOUT ROWID;

CREATE TABLE marker_auth_limits (
  key TEXT PRIMARY KEY CHECK (length(key) = 64),
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL CHECK (count > 0 AND count <= 100),
  last_at INTEGER NOT NULL,
  ticket TEXT NOT NULL CHECK (length(ticket) = 64)
) WITHOUT ROWID;

CREATE TABLE marker_auth_oauth_flows (
  state_hash TEXT PRIMARY KEY CHECK(length(state_hash)=64),
  browser_hash TEXT NOT NULL CHECK(length(browser_hash)=64),
  nonce_hash TEXT NOT NULL CHECK(length(nonce_hash)=64),
  sealed_verifier TEXT NOT NULL,
  intent TEXT NOT NULL CHECK(intent IN ('login','link')),
  session_hash TEXT REFERENCES marker_auth_sessions(session_hash) ON DELETE CASCADE,
  owner_hash TEXT NOT NULL CHECK(length(owner_hash)=64),
  client_id_hash TEXT NOT NULL CHECK(length(client_id_hash)=64),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK(expires_at=created_at+600)
, provider TEXT NOT NULL DEFAULT 'google' CHECK(provider IN ('google','github'))) WITHOUT ROWID;

CREATE TABLE marker_auth_oauth_limits (
  ip_hash TEXT PRIMARY KEY CHECK(length(ip_hash)=64),
  window_start INTEGER NOT NULL, count INTEGER NOT NULL CHECK(count BETWEEN 1 AND 10)
) WITHOUT ROWID;

CREATE TABLE marker_auth_operator (
  id INTEGER PRIMARY KEY CHECK(id=1),
  tenant_id TEXT NOT NULL UNIQUE CHECK(length(tenant_id)=32),
  user_id TEXT NOT NULL UNIQUE CHECK(length(user_id)=32),
  owner_hash TEXT UNIQUE CHECK(owner_hash IS NULL OR length(owner_hash)=64)
);

CREATE TABLE "marker_auth_principals" (
  session_hash TEXT PRIMARY KEY REFERENCES marker_auth_sessions(session_hash) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES marker_auth_operator(tenant_id),
  user_id TEXT NOT NULL REFERENCES marker_auth_operator(user_id),
  auth_method TEXT NOT NULL CHECK(auth_method IN ('email','google','github')),
  authenticated_at INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE marker_auth_sessions (
  session_hash TEXT PRIMARY KEY CHECK (length(session_hash) = 64),
  owner_hash TEXT NOT NULL CHECK (length(owner_hash) = 64),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at = created_at + 21600),
  last_seen INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE marker_mcp_clients (
  client_id TEXT PRIMARY KEY, name TEXT NOT NULL, redirect_uris TEXT NOT NULL,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
, authorized_at INTEGER) WITHOUT ROWID;

CREATE TABLE marker_mcp_codes (
  code_hash TEXT PRIMARY KEY CHECK(length(code_hash)=64),
  grant_id TEXT NOT NULL REFERENCES marker_mcp_grants(grant_id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES marker_mcp_clients(client_id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL, challenge TEXT NOT NULL,
  expires_at INTEGER NOT NULL, consumed_by TEXT
) WITHOUT ROWID;

CREATE TABLE marker_mcp_effects (
  grant_id TEXT NOT NULL REFERENCES marker_mcp_grants(grant_id) ON DELETE CASCADE,
  request_id TEXT NOT NULL, digest TEXT NOT NULL, status TEXT NOT NULL,
  result_json TEXT, created_at INTEGER NOT NULL,
  PRIMARY KEY(grant_id,request_id)
) WITHOUT ROWID;

CREATE TABLE marker_mcp_grants (
  grant_id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES marker_mcp_clients(client_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES marker_auth_operator(user_id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES marker_auth_operator(tenant_id) ON DELETE CASCADE,
  scopes TEXT NOT NULL, resource TEXT NOT NULL, created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL, revoked_at INTEGER
) WITHOUT ROWID;

CREATE TABLE marker_mcp_limits (
  key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE marker_mcp_login_requests (
  request_hash TEXT PRIMARY KEY CHECK(length(request_hash)=64),
  client_id TEXT NOT NULL REFERENCES marker_mcp_clients(client_id) ON DELETE CASCADE,
  document TEXT NOT NULL, expires_at INTEGER NOT NULL, consumed_by TEXT
) WITHOUT ROWID;

CREATE TABLE marker_mcp_requests (
  request_hash TEXT PRIMARY KEY CHECK(length(request_hash)=64),
  client_id TEXT NOT NULL REFERENCES marker_mcp_clients(client_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES marker_auth_operator(user_id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES marker_auth_operator(tenant_id) ON DELETE CASCADE,
  document TEXT NOT NULL, expires_at INTEGER NOT NULL, consumed_by TEXT
) WITHOUT ROWID;

CREATE TABLE marker_mcp_tokens (
  access_hash TEXT PRIMARY KEY CHECK(length(access_hash)=64),
  refresh_hash TEXT UNIQUE NOT NULL CHECK(length(refresh_hash)=64),
  grant_id TEXT NOT NULL REFERENCES marker_mcp_grants(grant_id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES marker_mcp_clients(client_id) ON DELETE CASCADE,
  access_expires_at INTEGER NOT NULL, refresh_expires_at INTEGER NOT NULL, consumed_by TEXT
) WITHOUT ROWID;

CREATE TABLE marker_policy_acknowledgements (
  user_id TEXT NOT NULL REFERENCES marker_auth_operator(user_id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES marker_auth_operator(tenant_id) ON DELETE CASCADE,
  terms_version TEXT NOT NULL,
  privacy_notice_version TEXT NOT NULL,
  cookies_notice_version TEXT NOT NULL,
  purpose_version TEXT NOT NULL,
  acknowledged_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,tenant_id)
) WITHOUT ROWID;

CREATE TABLE marker_profile (
  id INTEGER PRIMARY KEY CHECK(id=1),
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
  name TEXT NOT NULL DEFAULT '' CHECK(length(name)<=120),
  country TEXT NOT NULL DEFAULT '' CHECK(length(country)<=80),
  email TEXT NOT NULL DEFAULT '' CHECK(length(email)<=254)
);

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

CREATE INDEX marker_agent_events_session ON marker_agent_events(session_id,created_at);

CREATE INDEX marker_agent_proposals_session ON marker_agent_proposals(json_extract(document,'$.sessionId'));

CREATE INDEX marker_agent_runs_session ON marker_agent_runs(json_extract(document,'$.sessionId'));

CREATE INDEX marker_agent_runs_status ON marker_agent_runs(status,updated_at);

CREATE INDEX marker_mcp_grants_owner ON marker_mcp_grants(user_id,tenant_id);

CREATE INDEX marker_mcp_tokens_grant ON marker_mcp_tokens(grant_id);

CREATE INDEX marker_studio_analysis_asset ON marker_studio_analysis(asset_id);

CREATE UNIQUE INDEX marker_studio_analysis_cache ON marker_studio_analysis(sha256,start_ms,end_ms,profile,tool_version) WHERE status!='failed';

CREATE INDEX marker_studio_analysis_status ON marker_studio_analysis(status);

CREATE INDEX marker_studio_assets_hash ON marker_studio_assets(sha256);

CREATE INDEX marker_studio_jobs_recipe ON marker_studio_jobs(variant_id,recipe_revision);

CREATE UNIQUE INDEX marker_studio_one_render ON marker_studio_jobs((1)) WHERE status IN ('queued','running');

CREATE UNIQUE INDEX marker_studio_one_upload ON marker_studio_uploads(status) WHERE status='uploading';

CREATE INDEX marker_studio_variants_campaign ON marker_studio_variants(campaign_id);

CREATE TRIGGER marker_account_deleted_permanent BEFORE UPDATE ON marker_account_lifecycle
WHEN OLD.status='deleted' AND NEW.status!='deleted'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_agent_connections_account_insert BEFORE INSERT ON marker_agent_connections
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_agent_connections_account_update BEFORE UPDATE ON marker_agent_connections
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_agent_events_account_insert BEFORE INSERT ON marker_agent_events
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_agent_events_account_update BEFORE UPDATE ON marker_agent_events
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_agent_meta_account_insert BEFORE INSERT ON marker_agent_meta
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_agent_meta_account_update BEFORE UPDATE ON marker_agent_meta
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_agent_proposals_account_insert BEFORE INSERT ON marker_agent_proposals
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_agent_proposals_account_update BEFORE UPDATE ON marker_agent_proposals
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_agent_runs_account_insert BEFORE INSERT ON marker_agent_runs
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_agent_runs_account_update BEFORE UPDATE ON marker_agent_runs
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_agent_sessions_account_insert BEFORE INSERT ON marker_agent_sessions
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_agent_sessions_account_update BEFORE UPDATE ON marker_agent_sessions
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_analytics_subject_account_insert BEFORE INSERT ON marker_analytics_subject
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_auth_challenges_account_insert BEFORE INSERT ON marker_auth_challenges
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_auth_challenges_account_update BEFORE UPDATE ON marker_auth_challenges
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_auth_identities_account_insert BEFORE INSERT ON marker_auth_identities
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_auth_identities_account_update BEFORE UPDATE ON marker_auth_identities
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_auth_limits_account_insert BEFORE INSERT ON marker_auth_limits
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_auth_limits_account_update BEFORE UPDATE ON marker_auth_limits
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_auth_oauth_flows_account_insert BEFORE INSERT ON marker_auth_oauth_flows
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_auth_oauth_flows_account_update BEFORE UPDATE ON marker_auth_oauth_flows
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_auth_oauth_limits_account_insert BEFORE INSERT ON marker_auth_oauth_limits
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_auth_oauth_limits_account_update BEFORE UPDATE ON marker_auth_oauth_limits
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_auth_operator_account_insert BEFORE INSERT ON marker_auth_operator
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_auth_operator_account_update BEFORE UPDATE ON marker_auth_operator
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_auth_principals_account_insert BEFORE INSERT ON marker_auth_principals
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_auth_principals_account_update BEFORE UPDATE ON marker_auth_principals
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_auth_sessions_account_insert BEFORE INSERT ON marker_auth_sessions
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_auth_sessions_account_update BEFORE UPDATE ON marker_auth_sessions
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_mcp_clients_active_insert BEFORE INSERT ON marker_mcp_clients WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_mcp_clients_active_update BEFORE UPDATE ON marker_mcp_clients WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_mcp_codes_active_insert BEFORE INSERT ON marker_mcp_codes WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_mcp_codes_active_update BEFORE UPDATE ON marker_mcp_codes WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_mcp_effects_active_insert BEFORE INSERT ON marker_mcp_effects WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_mcp_effects_active_update BEFORE UPDATE ON marker_mcp_effects WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_mcp_grants_active_insert BEFORE INSERT ON marker_mcp_grants WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_mcp_grants_active_update BEFORE UPDATE ON marker_mcp_grants WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_mcp_limits_active_insert BEFORE INSERT ON marker_mcp_limits WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_mcp_limits_active_update BEFORE UPDATE ON marker_mcp_limits WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_mcp_login_requests_active_insert BEFORE INSERT ON marker_mcp_login_requests WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_mcp_login_requests_active_update BEFORE UPDATE ON marker_mcp_login_requests WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_mcp_requests_active_insert BEFORE INSERT ON marker_mcp_requests WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_mcp_requests_active_update BEFORE UPDATE ON marker_mcp_requests WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_mcp_tokens_active_insert BEFORE INSERT ON marker_mcp_tokens WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_mcp_tokens_active_update BEFORE UPDATE ON marker_mcp_tokens WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_profile_account_insert BEFORE INSERT ON marker_profile
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_profile_account_update BEFORE UPDATE ON marker_profile
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_studio_analysis_account_insert BEFORE INSERT ON marker_studio_analysis
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_studio_analysis_account_update BEFORE UPDATE ON marker_studio_analysis
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_studio_assets_account_insert BEFORE INSERT ON marker_studio_assets
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_studio_assets_account_update BEFORE UPDATE ON marker_studio_assets
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_studio_campaigns_account_insert BEFORE INSERT ON marker_studio_campaigns
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_studio_campaigns_account_update BEFORE UPDATE ON marker_studio_campaigns
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_studio_compute_account_insert BEFORE INSERT ON marker_studio_compute
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_studio_compute_account_update BEFORE UPDATE ON marker_studio_compute
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_studio_jobs_account_insert BEFORE INSERT ON marker_studio_jobs
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_studio_jobs_account_update BEFORE UPDATE ON marker_studio_jobs
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_studio_limits_account_insert BEFORE INSERT ON marker_studio_limits
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_studio_limits_account_update BEFORE UPDATE ON marker_studio_limits
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_studio_materials_account_insert BEFORE INSERT ON marker_studio_materials
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_studio_materials_account_update BEFORE UPDATE ON marker_studio_materials
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_studio_meta_account_insert BEFORE INSERT ON marker_studio_meta
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_studio_meta_account_update BEFORE UPDATE ON marker_studio_meta
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_studio_settings_account_insert BEFORE INSERT ON marker_studio_settings
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_studio_settings_account_update BEFORE UPDATE ON marker_studio_settings
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_studio_uploads_account_insert BEFORE INSERT ON marker_studio_uploads
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_studio_uploads_account_update BEFORE UPDATE ON marker_studio_uploads
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_studio_variants_account_insert BEFORE INSERT ON marker_studio_variants
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_studio_variants_account_update BEFORE UPDATE ON marker_studio_variants
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_workspace_account_insert BEFORE INSERT ON marker_workspace
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;

CREATE TRIGGER marker_workspace_account_update BEFORE UPDATE ON marker_workspace
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
