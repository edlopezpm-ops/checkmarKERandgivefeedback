-- Delegated MCP authorization is additive; native owner login remains separate.
CREATE TABLE marker_mcp_clients (
  client_id TEXT PRIMARY KEY, name TEXT NOT NULL, redirect_uris TEXT NOT NULL,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
) WITHOUT ROWID;
CREATE TABLE marker_mcp_grants (
  grant_id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES marker_mcp_clients(client_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES marker_auth_operator(user_id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES marker_auth_operator(tenant_id) ON DELETE CASCADE,
  scopes TEXT NOT NULL, resource TEXT NOT NULL, created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL, revoked_at INTEGER
) WITHOUT ROWID;
CREATE INDEX marker_mcp_grants_owner ON marker_mcp_grants(user_id,tenant_id);
CREATE TABLE marker_mcp_requests (
  request_hash TEXT PRIMARY KEY CHECK(length(request_hash)=64),
  client_id TEXT NOT NULL REFERENCES marker_mcp_clients(client_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES marker_auth_operator(user_id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES marker_auth_operator(tenant_id) ON DELETE CASCADE,
  document TEXT NOT NULL, expires_at INTEGER NOT NULL, consumed_by TEXT
) WITHOUT ROWID;
CREATE TABLE marker_mcp_codes (
  code_hash TEXT PRIMARY KEY CHECK(length(code_hash)=64),
  grant_id TEXT NOT NULL REFERENCES marker_mcp_grants(grant_id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES marker_mcp_clients(client_id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL, challenge TEXT NOT NULL,
  expires_at INTEGER NOT NULL, consumed_by TEXT
) WITHOUT ROWID;
CREATE TABLE marker_mcp_tokens (
  access_hash TEXT PRIMARY KEY CHECK(length(access_hash)=64),
  refresh_hash TEXT UNIQUE NOT NULL CHECK(length(refresh_hash)=64),
  grant_id TEXT NOT NULL REFERENCES marker_mcp_grants(grant_id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES marker_mcp_clients(client_id) ON DELETE CASCADE,
  access_expires_at INTEGER NOT NULL, refresh_expires_at INTEGER NOT NULL, consumed_by TEXT
) WITHOUT ROWID;
CREATE INDEX marker_mcp_tokens_grant ON marker_mcp_tokens(grant_id);
CREATE TABLE marker_mcp_limits (
  key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL
) WITHOUT ROWID;
CREATE TABLE marker_mcp_effects (
  grant_id TEXT NOT NULL REFERENCES marker_mcp_grants(grant_id) ON DELETE CASCADE,
  request_id TEXT NOT NULL, digest TEXT NOT NULL, status TEXT NOT NULL,
  result_json TEXT, created_at INTEGER NOT NULL,
  PRIMARY KEY(grant_id,request_id)
) WITHOUT ROWID;
-- Freeze already-admitted requests during account deletion, as for domain data.
CREATE TRIGGER marker_mcp_clients_active_insert BEFORE INSERT ON marker_mcp_clients WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_mcp_clients_active_update BEFORE UPDATE ON marker_mcp_clients WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_mcp_grants_active_insert BEFORE INSERT ON marker_mcp_grants WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_mcp_grants_active_update BEFORE UPDATE ON marker_mcp_grants WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_mcp_requests_active_insert BEFORE INSERT ON marker_mcp_requests WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_mcp_requests_active_update BEFORE UPDATE ON marker_mcp_requests WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_mcp_codes_active_insert BEFORE INSERT ON marker_mcp_codes WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_mcp_codes_active_update BEFORE UPDATE ON marker_mcp_codes WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_mcp_tokens_active_insert BEFORE INSERT ON marker_mcp_tokens WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_mcp_tokens_active_update BEFORE UPDATE ON marker_mcp_tokens WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_mcp_limits_active_insert BEFORE INSERT ON marker_mcp_limits WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_mcp_limits_active_update BEFORE UPDATE ON marker_mcp_limits WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_mcp_effects_active_insert BEFORE INSERT ON marker_mcp_effects WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_mcp_effects_active_update BEFORE UPDATE ON marker_mcp_effects WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
