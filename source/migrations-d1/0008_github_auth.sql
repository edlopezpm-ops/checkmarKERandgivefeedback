-- Preserve every retained Google/email principal and identity while adding one
-- optional GitHub binding to the same singleton. Business rows are untouched.
CREATE TABLE marker_auth_principals_github (
  session_hash TEXT PRIMARY KEY REFERENCES marker_auth_sessions(session_hash) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES marker_auth_operator(tenant_id),
  user_id TEXT NOT NULL REFERENCES marker_auth_operator(user_id),
  auth_method TEXT NOT NULL CHECK(auth_method IN ('email','google','github')),
  authenticated_at INTEGER NOT NULL
) WITHOUT ROWID;
INSERT INTO marker_auth_principals_github SELECT * FROM marker_auth_principals;
DROP TABLE marker_auth_principals;
ALTER TABLE marker_auth_principals_github RENAME TO marker_auth_principals;
CREATE TABLE marker_auth_identities_github (
  issuer TEXT NOT NULL CHECK(issuer IN ('https://accounts.google.com','https://github.com')),
  subject_hash TEXT NOT NULL CHECK(length(subject_hash)=64),
  tenant_id TEXT NOT NULL REFERENCES marker_auth_operator(tenant_id),
  user_id TEXT NOT NULL REFERENCES marker_auth_operator(user_id),
  linked_at INTEGER NOT NULL,
  PRIMARY KEY(issuer,subject_hash), UNIQUE(tenant_id,user_id,issuer)
) WITHOUT ROWID;
INSERT INTO marker_auth_identities_github SELECT * FROM marker_auth_identities;
DROP TABLE marker_auth_identities;
ALTER TABLE marker_auth_identities_github RENAME TO marker_auth_identities;
ALTER TABLE marker_auth_oauth_flows ADD COLUMN provider TEXT NOT NULL DEFAULT 'google' CHECK(provider IN ('google','github'));
