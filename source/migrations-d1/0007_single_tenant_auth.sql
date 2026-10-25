-- One retained operator and workspace identity. Business data stays in place.
CREATE TABLE marker_auth_operator (
  id INTEGER PRIMARY KEY CHECK(id=1),
  tenant_id TEXT NOT NULL UNIQUE CHECK(length(tenant_id)=32),
  user_id TEXT NOT NULL UNIQUE CHECK(length(user_id)=32),
  owner_hash TEXT UNIQUE CHECK(owner_hash IS NULL OR length(owner_hash)=64)
);
INSERT INTO marker_auth_operator(id,tenant_id,user_id) VALUES(1,lower(hex(randomblob(16))),lower(hex(randomblob(16))));
CREATE TABLE marker_auth_principals (
  session_hash TEXT PRIMARY KEY REFERENCES marker_auth_sessions(session_hash) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES marker_auth_operator(tenant_id),
  user_id TEXT NOT NULL REFERENCES marker_auth_operator(user_id),
  auth_method TEXT NOT NULL CHECK(auth_method IN ('email','google')),
  authenticated_at INTEGER NOT NULL
) WITHOUT ROWID;
CREATE TABLE marker_auth_identities (
  issuer TEXT NOT NULL CHECK(issuer='https://accounts.google.com'),
  subject_hash TEXT NOT NULL CHECK(length(subject_hash)=64),
  tenant_id TEXT NOT NULL REFERENCES marker_auth_operator(tenant_id),
  user_id TEXT NOT NULL REFERENCES marker_auth_operator(user_id),
  linked_at INTEGER NOT NULL,
  PRIMARY KEY(issuer,subject_hash), UNIQUE(tenant_id,user_id,issuer)
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
) WITHOUT ROWID;
CREATE TABLE marker_auth_oauth_limits (
  ip_hash TEXT PRIMARY KEY CHECK(length(ip_hash)=64),
  window_start INTEGER NOT NULL, count INTEGER NOT NULL CHECK(count BETWEEN 1 AND 10)
) WITHOUT ROWID;
