-- Additive single-owner profile and durable, PII-free workspace tombstone.
CREATE TABLE marker_profile (
  id INTEGER PRIMARY KEY CHECK(id=1),
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
  name TEXT NOT NULL DEFAULT '' CHECK(length(name)<=120),
  country TEXT NOT NULL DEFAULT '' CHECK(length(country)<=80),
  email TEXT NOT NULL DEFAULT '' CHECK(length(email)<=254)
);
INSERT INTO marker_profile(id) VALUES(1);
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
INSERT INTO marker_account_lifecycle(id,status,phase) VALUES(1,'active','active');
CREATE TRIGGER marker_account_deleted_permanent BEFORE UPDATE ON marker_account_lifecycle
WHEN OLD.status='deleted' AND NEW.status!='deleted'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
-- Deletion may remove rows. Already-admitted requests cannot recreate or mutate
-- account data after the durable freeze, including callback/provider/bridge work.
CREATE TRIGGER marker_profile_account_insert BEFORE INSERT ON marker_profile
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_profile_account_update BEFORE UPDATE ON marker_profile
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_auth_limits_account_insert BEFORE INSERT ON marker_auth_limits
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_auth_limits_account_update BEFORE UPDATE ON marker_auth_limits
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_auth_challenges_account_insert BEFORE INSERT ON marker_auth_challenges
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_auth_challenges_account_update BEFORE UPDATE ON marker_auth_challenges
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_auth_sessions_account_insert BEFORE INSERT ON marker_auth_sessions
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_auth_sessions_account_update BEFORE UPDATE ON marker_auth_sessions
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_workspace_account_insert BEFORE INSERT ON marker_workspace
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_workspace_account_update BEFORE UPDATE ON marker_workspace
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_studio_meta_account_insert BEFORE INSERT ON marker_studio_meta
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_studio_meta_account_update BEFORE UPDATE ON marker_studio_meta
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_studio_assets_account_insert BEFORE INSERT ON marker_studio_assets
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_studio_assets_account_update BEFORE UPDATE ON marker_studio_assets
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_studio_materials_account_insert BEFORE INSERT ON marker_studio_materials
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_studio_materials_account_update BEFORE UPDATE ON marker_studio_materials
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_studio_campaigns_account_insert BEFORE INSERT ON marker_studio_campaigns
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_studio_campaigns_account_update BEFORE UPDATE ON marker_studio_campaigns
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_studio_variants_account_insert BEFORE INSERT ON marker_studio_variants
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_studio_variants_account_update BEFORE UPDATE ON marker_studio_variants
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_studio_uploads_account_insert BEFORE INSERT ON marker_studio_uploads
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_studio_uploads_account_update BEFORE UPDATE ON marker_studio_uploads
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
CREATE TRIGGER marker_studio_compute_account_insert BEFORE INSERT ON marker_studio_compute
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_studio_compute_account_update BEFORE UPDATE ON marker_studio_compute
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_studio_analysis_account_insert BEFORE INSERT ON marker_studio_analysis
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_studio_analysis_account_update BEFORE UPDATE ON marker_studio_analysis
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_studio_settings_account_insert BEFORE INSERT ON marker_studio_settings
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_studio_settings_account_update BEFORE UPDATE ON marker_studio_settings
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_agent_connections_account_insert BEFORE INSERT ON marker_agent_connections
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_agent_connections_account_update BEFORE UPDATE ON marker_agent_connections
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_agent_sessions_account_insert BEFORE INSERT ON marker_agent_sessions
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_agent_sessions_account_update BEFORE UPDATE ON marker_agent_sessions
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_agent_runs_account_insert BEFORE INSERT ON marker_agent_runs
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_agent_runs_account_update BEFORE UPDATE ON marker_agent_runs
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_agent_proposals_account_insert BEFORE INSERT ON marker_agent_proposals
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_agent_proposals_account_update BEFORE UPDATE ON marker_agent_proposals
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
CREATE TRIGGER marker_auth_identities_account_insert BEFORE INSERT ON marker_auth_identities
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER marker_auth_identities_account_update BEFORE UPDATE ON marker_auth_identities
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
