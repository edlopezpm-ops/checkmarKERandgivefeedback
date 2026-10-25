-- Authorized public OAuth clients remain stable when the host reconnects.
-- The existing expiry continues to bound registrations that were never approved.
ALTER TABLE marker_mcp_clients ADD COLUMN authorized_at INTEGER;
UPDATE marker_mcp_clients SET authorized_at=(
  SELECT MIN(created_at) FROM marker_mcp_grants g WHERE g.client_id=marker_mcp_clients.client_id
) WHERE EXISTS(SELECT 1 FROM marker_mcp_grants g WHERE g.client_id=marker_mcp_clients.client_id);

-- A pending login is correlation state, never an owner grant or bearer token.
CREATE TABLE marker_mcp_login_requests (
  request_hash TEXT PRIMARY KEY CHECK(length(request_hash)=64),
  client_id TEXT NOT NULL REFERENCES marker_mcp_clients(client_id) ON DELETE CASCADE,
  document TEXT NOT NULL, expires_at INTEGER NOT NULL, consumed_by TEXT
) WITHOUT ROWID;
CREATE TRIGGER marker_mcp_login_requests_active_insert BEFORE INSERT ON marker_mcp_login_requests WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_mcp_login_requests_active_update BEFORE UPDATE ON marker_mcp_login_requests WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed')!='active' BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
