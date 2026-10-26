-- Prospective deliberate acknowledgements only. Never backfill from visits,
-- existing accounts, sign-in, optional storage choices or an MCP grant.
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
