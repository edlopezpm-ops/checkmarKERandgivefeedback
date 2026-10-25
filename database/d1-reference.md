# D1 application schema

36 tables; 201 columns; 14 explicit indexes; 71 triggers. Applied to an empty in-memory SQLite database and replayed from schema-only DDL. No runtime database or owner records were read. This does not establish remote migration state.

[SQL](d1-schema.sql) · [Catalog](d1-catalog.json)

| Table | Columns | Foreign keys | Indexes |
| --- | --- | --- | --- |
| marker_account_lifecycle | 8 | 0 | 0 |
| marker_agent_connections | 5 | 0 | 1 |
| marker_agent_events | 5 | 0 | 2 |
| marker_agent_meta | 3 | 0 | 0 |
| marker_agent_proposals | 5 | 0 | 2 |
| marker_agent_runs | 5 | 0 | 3 |
| marker_agent_sessions | 5 | 0 | 1 |
| marker_auth_challenges | 7 | 0 | 1 |
| marker_auth_identities | 5 | 2 | 2 |
| marker_auth_limits | 5 | 0 | 1 |
| marker_auth_oauth_flows | 11 | 1 | 1 |
| marker_auth_oauth_limits | 3 | 0 | 1 |
| marker_auth_operator | 4 | 0 | 3 |
| marker_auth_principals | 5 | 3 | 1 |
| marker_auth_sessions | 5 | 0 | 1 |
| marker_mcp_clients | 6 | 0 | 1 |
| marker_mcp_codes | 7 | 2 | 1 |
| marker_mcp_effects | 6 | 1 | 1 |
| marker_mcp_grants | 9 | 3 | 2 |
| marker_mcp_limits | 3 | 0 | 1 |
| marker_mcp_login_requests | 5 | 1 | 1 |
| marker_mcp_requests | 7 | 3 | 1 |
| marker_mcp_tokens | 7 | 2 | 3 |
| marker_profile | 5 | 0 | 0 |
| marker_studio_analysis | 13 | 1 | 4 |
| marker_studio_assets | 6 | 0 | 3 |
| marker_studio_campaigns | 3 | 0 | 1 |
| marker_studio_compute | 3 | 0 | 1 |
| marker_studio_jobs | 8 | 1 | 3 |
| marker_studio_limits | 6 | 0 | 0 |
| marker_studio_materials | 4 | 1 | 1 |
| marker_studio_meta | 3 | 0 | 0 |
| marker_studio_settings | 7 | 0 | 0 |
| marker_studio_uploads | 5 | 0 | 2 |
| marker_studio_variants | 4 | 1 | 2 |
| marker_workspace | 3 | 0 | 0 |

## Inputs

- [migrations-d1/0001_private.sql](../source/migrations-d1/0001_private.sql)
- [migrations-d1/0002_studio.sql](../source/migrations-d1/0002_studio.sql)
- [migrations-d1/0003_studio_hosted.sql](../source/migrations-d1/0003_studio_hosted.sql)
- [migrations-d1/0004_studio_analysis.sql](../source/migrations-d1/0004_studio_analysis.sql)
- [migrations-d1/0005_studio_settings.sql](../source/migrations-d1/0005_studio_settings.sql)
- [migrations-d1/0006_agents.sql](../source/migrations-d1/0006_agents.sql)
- [migrations-d1/0007_single_tenant_auth.sql](../source/migrations-d1/0007_single_tenant_auth.sql)
- [migrations-d1/0008_github_auth.sql](../source/migrations-d1/0008_github_auth.sql)
- [migrations-d1/0009_profile_account.sql](../source/migrations-d1/0009_profile_account.sql)
- [migrations-d1/0010_mcp.sql](../source/migrations-d1/0010_mcp.sql)
- [migrations-d1/0011_mcp_connections.sql](../source/migrations-d1/0011_mcp_connections.sql)

## marker_account_lifecycle

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | INTEGER | False | None | 1 |
| status | TEXT | True | None | 0 |
| phase | TEXT | True | None | 0 |
| capability_hash | TEXT | False | None | 0 |
| lease_token | TEXT | False | None | 0 |
| lease_until | INTEGER | True | 0 | 0 |
| deleted_objects | INTEGER | True | 0 | 0 |
| needs_retry | INTEGER | True | 0 | 0 |

```sql
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
```

## marker_agent_connections

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 |
| revision | INTEGER | True | 0 | 0 |
| status | TEXT | True | None | 0 |
| updated_at | TEXT | True | None | 0 |
| document | TEXT | True | None | 0 |

```sql
CREATE TABLE marker_agent_connections(id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, updated_at TEXT NOT NULL, document TEXT NOT NULL CHECK(json_valid(document)));
```

## marker_agent_events

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 |
| run_id | TEXT | True | None | 0 |
| session_id | TEXT | True | None | 0 |
| created_at | TEXT | True | None | 0 |
| document | TEXT | True | None | 0 |

```sql
CREATE TABLE marker_agent_events(id TEXT PRIMARY KEY,run_id TEXT NOT NULL,session_id TEXT NOT NULL,created_at TEXT NOT NULL,document TEXT NOT NULL CHECK(json_valid(document)));
```

## marker_agent_meta

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | INTEGER | False | None | 1 |
| revision | INTEGER | True | 0 | 0 |
| document | TEXT | True | None | 0 |

```sql
CREATE TABLE marker_agent_meta(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL DEFAULT 0,document TEXT NOT NULL CHECK(json_valid(document)));
```

## marker_agent_proposals

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 |
| revision | INTEGER | True | 0 | 0 |
| status | TEXT | True | None | 0 |
| updated_at | TEXT | True | None | 0 |
| document | TEXT | True | None | 0 |

```sql
CREATE TABLE marker_agent_proposals(id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, updated_at TEXT NOT NULL, document TEXT NOT NULL CHECK(json_valid(document)));
```

## marker_agent_runs

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 |
| revision | INTEGER | True | 0 | 0 |
| status | TEXT | True | None | 0 |
| updated_at | TEXT | True | None | 0 |
| document | TEXT | True | None | 0 |

```sql
CREATE TABLE marker_agent_runs(id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, updated_at TEXT NOT NULL, document TEXT NOT NULL CHECK(json_valid(document)));
```

## marker_agent_sessions

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 |
| revision | INTEGER | True | 0 | 0 |
| status | TEXT | True | 'open' | 0 |
| updated_at | TEXT | True | None | 0 |
| document | TEXT | True | None | 0 |

```sql
CREATE TABLE marker_agent_sessions(id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'open', updated_at TEXT NOT NULL, document TEXT NOT NULL CHECK(json_valid(document)));
```

## marker_auth_challenges

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| challenge_hash | TEXT | True | None | 1 |
| owner_hash | TEXT | True | None | 0 |
| code_hash | TEXT | True | None | 0 |
| created_at | INTEGER | True | None | 0 |
| expires_at | INTEGER | True | None | 0 |
| attempts | INTEGER | True | 0 | 0 |
| consumed_at | INTEGER | False | None | 0 |

```sql
CREATE TABLE marker_auth_challenges (
  challenge_hash TEXT PRIMARY KEY CHECK (length(challenge_hash) = 64),
  owner_hash TEXT NOT NULL CHECK (length(owner_hash) = 64),
  code_hash TEXT NOT NULL CHECK (length(code_hash) = 64),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at = created_at + 300),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  consumed_at INTEGER
) WITHOUT ROWID;
```

## marker_auth_identities

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| issuer | TEXT | True | None | 1 |
| subject_hash | TEXT | True | None | 2 |
| tenant_id | TEXT | True | None | 0 |
| user_id | TEXT | True | None | 0 |
| linked_at | INTEGER | True | None | 0 |

```sql
CREATE TABLE "marker_auth_identities" (
  issuer TEXT NOT NULL CHECK(issuer IN ('https://accounts.google.com','https://github.com')),
  subject_hash TEXT NOT NULL CHECK(length(subject_hash)=64),
  tenant_id TEXT NOT NULL REFERENCES marker_auth_operator(tenant_id),
  user_id TEXT NOT NULL REFERENCES marker_auth_operator(user_id),
  linked_at INTEGER NOT NULL,
  PRIMARY KEY(issuer,subject_hash), UNIQUE(tenant_id,user_id,issuer)
) WITHOUT ROWID;
```

| From | Table | To | On delete |
| --- | --- | --- | --- |
| user_id | marker_auth_operator | user_id | NO ACTION |
| tenant_id | marker_auth_operator | tenant_id | NO ACTION |

## marker_auth_limits

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| key | TEXT | True | None | 1 |
| window_start | INTEGER | True | None | 0 |
| count | INTEGER | True | None | 0 |
| last_at | INTEGER | True | None | 0 |
| ticket | TEXT | True | None | 0 |

```sql
CREATE TABLE marker_auth_limits (
  key TEXT PRIMARY KEY CHECK (length(key) = 64),
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL CHECK (count > 0 AND count <= 100),
  last_at INTEGER NOT NULL,
  ticket TEXT NOT NULL CHECK (length(ticket) = 64)
) WITHOUT ROWID;
```

## marker_auth_oauth_flows

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| state_hash | TEXT | True | None | 1 |
| browser_hash | TEXT | True | None | 0 |
| nonce_hash | TEXT | True | None | 0 |
| sealed_verifier | TEXT | True | None | 0 |
| intent | TEXT | True | None | 0 |
| session_hash | TEXT | False | None | 0 |
| owner_hash | TEXT | True | None | 0 |
| client_id_hash | TEXT | True | None | 0 |
| created_at | INTEGER | True | None | 0 |
| expires_at | INTEGER | True | None | 0 |
| provider | TEXT | True | 'google' | 0 |

```sql
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
```

| From | Table | To | On delete |
| --- | --- | --- | --- |
| session_hash | marker_auth_sessions | session_hash | CASCADE |

## marker_auth_oauth_limits

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| ip_hash | TEXT | True | None | 1 |
| window_start | INTEGER | True | None | 0 |
| count | INTEGER | True | None | 0 |

```sql
CREATE TABLE marker_auth_oauth_limits (
  ip_hash TEXT PRIMARY KEY CHECK(length(ip_hash)=64),
  window_start INTEGER NOT NULL, count INTEGER NOT NULL CHECK(count BETWEEN 1 AND 10)
) WITHOUT ROWID;
```

## marker_auth_operator

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | INTEGER | False | None | 1 |
| tenant_id | TEXT | True | None | 0 |
| user_id | TEXT | True | None | 0 |
| owner_hash | TEXT | False | None | 0 |

```sql
CREATE TABLE marker_auth_operator (
  id INTEGER PRIMARY KEY CHECK(id=1),
  tenant_id TEXT NOT NULL UNIQUE CHECK(length(tenant_id)=32),
  user_id TEXT NOT NULL UNIQUE CHECK(length(user_id)=32),
  owner_hash TEXT UNIQUE CHECK(owner_hash IS NULL OR length(owner_hash)=64)
);
```

## marker_auth_principals

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| session_hash | TEXT | True | None | 1 |
| tenant_id | TEXT | True | None | 0 |
| user_id | TEXT | True | None | 0 |
| auth_method | TEXT | True | None | 0 |
| authenticated_at | INTEGER | True | None | 0 |

```sql
CREATE TABLE "marker_auth_principals" (
  session_hash TEXT PRIMARY KEY REFERENCES marker_auth_sessions(session_hash) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES marker_auth_operator(tenant_id),
  user_id TEXT NOT NULL REFERENCES marker_auth_operator(user_id),
  auth_method TEXT NOT NULL CHECK(auth_method IN ('email','google','github')),
  authenticated_at INTEGER NOT NULL
) WITHOUT ROWID;
```

| From | Table | To | On delete |
| --- | --- | --- | --- |
| user_id | marker_auth_operator | user_id | NO ACTION |
| tenant_id | marker_auth_operator | tenant_id | NO ACTION |
| session_hash | marker_auth_sessions | session_hash | CASCADE |

## marker_auth_sessions

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| session_hash | TEXT | True | None | 1 |
| owner_hash | TEXT | True | None | 0 |
| created_at | INTEGER | True | None | 0 |
| expires_at | INTEGER | True | None | 0 |
| last_seen | INTEGER | True | None | 0 |

```sql
CREATE TABLE marker_auth_sessions (
  session_hash TEXT PRIMARY KEY CHECK (length(session_hash) = 64),
  owner_hash TEXT NOT NULL CHECK (length(owner_hash) = 64),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at = created_at + 21600),
  last_seen INTEGER NOT NULL
) WITHOUT ROWID;
```

## marker_mcp_clients

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| client_id | TEXT | True | None | 1 |
| name | TEXT | True | None | 0 |
| redirect_uris | TEXT | True | None | 0 |
| created_at | INTEGER | True | None | 0 |
| expires_at | INTEGER | True | None | 0 |
| authorized_at | INTEGER | False | None | 0 |

```sql
CREATE TABLE marker_mcp_clients (
  client_id TEXT PRIMARY KEY, name TEXT NOT NULL, redirect_uris TEXT NOT NULL,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
, authorized_at INTEGER) WITHOUT ROWID;
```

## marker_mcp_codes

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| code_hash | TEXT | True | None | 1 |
| grant_id | TEXT | True | None | 0 |
| client_id | TEXT | True | None | 0 |
| redirect_uri | TEXT | True | None | 0 |
| challenge | TEXT | True | None | 0 |
| expires_at | INTEGER | True | None | 0 |
| consumed_by | TEXT | False | None | 0 |

```sql
CREATE TABLE marker_mcp_codes (
  code_hash TEXT PRIMARY KEY CHECK(length(code_hash)=64),
  grant_id TEXT NOT NULL REFERENCES marker_mcp_grants(grant_id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES marker_mcp_clients(client_id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL, challenge TEXT NOT NULL,
  expires_at INTEGER NOT NULL, consumed_by TEXT
) WITHOUT ROWID;
```

| From | Table | To | On delete |
| --- | --- | --- | --- |
| client_id | marker_mcp_clients | client_id | CASCADE |
| grant_id | marker_mcp_grants | grant_id | CASCADE |

## marker_mcp_effects

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| grant_id | TEXT | True | None | 1 |
| request_id | TEXT | True | None | 2 |
| digest | TEXT | True | None | 0 |
| status | TEXT | True | None | 0 |
| result_json | TEXT | False | None | 0 |
| created_at | INTEGER | True | None | 0 |

```sql
CREATE TABLE marker_mcp_effects (
  grant_id TEXT NOT NULL REFERENCES marker_mcp_grants(grant_id) ON DELETE CASCADE,
  request_id TEXT NOT NULL, digest TEXT NOT NULL, status TEXT NOT NULL,
  result_json TEXT, created_at INTEGER NOT NULL,
  PRIMARY KEY(grant_id,request_id)
) WITHOUT ROWID;
```

| From | Table | To | On delete |
| --- | --- | --- | --- |
| grant_id | marker_mcp_grants | grant_id | CASCADE |

## marker_mcp_grants

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| grant_id | TEXT | True | None | 1 |
| client_id | TEXT | True | None | 0 |
| user_id | TEXT | True | None | 0 |
| tenant_id | TEXT | True | None | 0 |
| scopes | TEXT | True | None | 0 |
| resource | TEXT | True | None | 0 |
| created_at | INTEGER | True | None | 0 |
| expires_at | INTEGER | True | None | 0 |
| revoked_at | INTEGER | False | None | 0 |

```sql
CREATE TABLE marker_mcp_grants (
  grant_id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES marker_mcp_clients(client_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES marker_auth_operator(user_id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES marker_auth_operator(tenant_id) ON DELETE CASCADE,
  scopes TEXT NOT NULL, resource TEXT NOT NULL, created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL, revoked_at INTEGER
) WITHOUT ROWID;
```

| From | Table | To | On delete |
| --- | --- | --- | --- |
| tenant_id | marker_auth_operator | tenant_id | CASCADE |
| user_id | marker_auth_operator | user_id | CASCADE |
| client_id | marker_mcp_clients | client_id | CASCADE |

## marker_mcp_limits

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| key | TEXT | True | None | 1 |
| window_start | INTEGER | True | None | 0 |
| count | INTEGER | True | None | 0 |

```sql
CREATE TABLE marker_mcp_limits (
  key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL
) WITHOUT ROWID;
```

## marker_mcp_login_requests

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| request_hash | TEXT | True | None | 1 |
| client_id | TEXT | True | None | 0 |
| document | TEXT | True | None | 0 |
| expires_at | INTEGER | True | None | 0 |
| consumed_by | TEXT | False | None | 0 |

```sql
CREATE TABLE marker_mcp_login_requests (
  request_hash TEXT PRIMARY KEY CHECK(length(request_hash)=64),
  client_id TEXT NOT NULL REFERENCES marker_mcp_clients(client_id) ON DELETE CASCADE,
  document TEXT NOT NULL, expires_at INTEGER NOT NULL, consumed_by TEXT
) WITHOUT ROWID;
```

| From | Table | To | On delete |
| --- | --- | --- | --- |
| client_id | marker_mcp_clients | client_id | CASCADE |

## marker_mcp_requests

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| request_hash | TEXT | True | None | 1 |
| client_id | TEXT | True | None | 0 |
| user_id | TEXT | True | None | 0 |
| tenant_id | TEXT | True | None | 0 |
| document | TEXT | True | None | 0 |
| expires_at | INTEGER | True | None | 0 |
| consumed_by | TEXT | False | None | 0 |

```sql
CREATE TABLE marker_mcp_requests (
  request_hash TEXT PRIMARY KEY CHECK(length(request_hash)=64),
  client_id TEXT NOT NULL REFERENCES marker_mcp_clients(client_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES marker_auth_operator(user_id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES marker_auth_operator(tenant_id) ON DELETE CASCADE,
  document TEXT NOT NULL, expires_at INTEGER NOT NULL, consumed_by TEXT
) WITHOUT ROWID;
```

| From | Table | To | On delete |
| --- | --- | --- | --- |
| tenant_id | marker_auth_operator | tenant_id | CASCADE |
| user_id | marker_auth_operator | user_id | CASCADE |
| client_id | marker_mcp_clients | client_id | CASCADE |

## marker_mcp_tokens

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| access_hash | TEXT | True | None | 1 |
| refresh_hash | TEXT | True | None | 0 |
| grant_id | TEXT | True | None | 0 |
| client_id | TEXT | True | None | 0 |
| access_expires_at | INTEGER | True | None | 0 |
| refresh_expires_at | INTEGER | True | None | 0 |
| consumed_by | TEXT | False | None | 0 |

```sql
CREATE TABLE marker_mcp_tokens (
  access_hash TEXT PRIMARY KEY CHECK(length(access_hash)=64),
  refresh_hash TEXT UNIQUE NOT NULL CHECK(length(refresh_hash)=64),
  grant_id TEXT NOT NULL REFERENCES marker_mcp_grants(grant_id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES marker_mcp_clients(client_id) ON DELETE CASCADE,
  access_expires_at INTEGER NOT NULL, refresh_expires_at INTEGER NOT NULL, consumed_by TEXT
) WITHOUT ROWID;
```

| From | Table | To | On delete |
| --- | --- | --- | --- |
| client_id | marker_mcp_clients | client_id | CASCADE |
| grant_id | marker_mcp_grants | grant_id | CASCADE |

## marker_profile

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | INTEGER | False | None | 1 |
| revision | INTEGER | True | 0 | 0 |
| name | TEXT | True | '' | 0 |
| country | TEXT | True | '' | 0 |
| email | TEXT | True | '' | 0 |

```sql
CREATE TABLE marker_profile (
  id INTEGER PRIMARY KEY CHECK(id=1),
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
  name TEXT NOT NULL DEFAULT '' CHECK(length(name)<=120),
  country TEXT NOT NULL DEFAULT '' CHECK(length(country)<=80),
  email TEXT NOT NULL DEFAULT '' CHECK(length(email)<=254)
);
```

## marker_studio_analysis

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 |
| asset_id | TEXT | True | None | 0 |
| sha256 | TEXT | True | None | 0 |
| start_ms | INTEGER | True | None | 0 |
| end_ms | INTEGER | True | None | 0 |
| profile | TEXT | True | None | 0 |
| tool_version | TEXT | True | None | 0 |
| status | TEXT | True | None | 0 |
| document | TEXT | True | None | 0 |
| lock_token | TEXT | False | None | 0 |
| lock_until | INTEGER | True | 0 | 0 |
| reserved_bytes | INTEGER | True | 0 | 0 |
| metadata_reserved | INTEGER | True | 0 | 0 |

```sql
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
```

| From | Table | To | On delete |
| --- | --- | --- | --- |
| asset_id | marker_studio_assets | id | RESTRICT |

## marker_studio_assets

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 |
| sha256 | TEXT | True | None | 0 |
| kind | TEXT | True | None | 0 |
| size_bytes | INTEGER | True | None | 0 |
| storage_key | TEXT | True | None | 0 |
| document | TEXT | True | None | 0 |

```sql
CREATE TABLE marker_studio_assets (
  id TEXT PRIMARY KEY,
  sha256 TEXT NOT NULL CHECK(length(sha256)=64),
  kind TEXT NOT NULL CHECK(kind IN ('video','image','audio')),
  size_bytes INTEGER NOT NULL CHECK(size_bytes BETWEEN 1 AND 262144000),
  storage_key TEXT NOT NULL UNIQUE,
  document TEXT NOT NULL CHECK(json_valid(document))
);
```

## marker_studio_campaigns

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 |
| product_id | TEXT | True | None | 0 |
| document | TEXT | True | None | 0 |

```sql
CREATE TABLE marker_studio_campaigns (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  document TEXT NOT NULL CHECK(json_valid(document))
);
```

## marker_studio_compute

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| month | TEXT | False | None | 1 |
| used_cents | INTEGER | True | 0 | 0 |
| last_token | TEXT | False | None | 0 |

```sql
CREATE TABLE marker_studio_compute (
  month TEXT PRIMARY KEY CHECK(length(month)=7),
  used_cents INTEGER NOT NULL DEFAULT 0 CHECK(used_cents>=0),
  last_token TEXT
);
```

## marker_studio_jobs

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 |
| variant_id | TEXT | True | None | 0 |
| recipe_revision | INTEGER | True | None | 0 |
| status | TEXT | True | None | 0 |
| document | TEXT | True | None | 0 |
| lock_token | TEXT | False | None | 0 |
| lock_until | INTEGER | True | 0 | 0 |
| reserved_bytes | INTEGER | True | 0 | 0 |

```sql
CREATE TABLE marker_studio_jobs (
  id TEXT PRIMARY KEY,
  variant_id TEXT NOT NULL REFERENCES marker_studio_variants(id) ON DELETE RESTRICT,
  recipe_revision INTEGER NOT NULL CHECK(recipe_revision>0),
  status TEXT NOT NULL CHECK(status IN ('queued','running','completed','failed')),
  document TEXT NOT NULL CHECK(json_valid(document))
, lock_token TEXT, lock_until INTEGER NOT NULL DEFAULT 0, reserved_bytes INTEGER NOT NULL DEFAULT 0 CHECK(reserved_bytes>=0));
```

| From | Table | To | On delete |
| --- | --- | --- | --- |
| variant_id | marker_studio_variants | id | RESTRICT |

## marker_studio_limits

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | INTEGER | False | None | 1 |
| stored_bytes | INTEGER | True | 0 | 0 |
| reserved_bytes | INTEGER | True | 0 | 0 |
| upload_token | TEXT | False | None | 0 |
| compute_token | TEXT | False | None | 0 |
| compute_until | INTEGER | True | 0 | 0 |

```sql
CREATE TABLE marker_studio_limits (
  id INTEGER PRIMARY KEY CHECK(id=1),
  stored_bytes INTEGER NOT NULL DEFAULT 0 CHECK(stored_bytes>=0),
  reserved_bytes INTEGER NOT NULL DEFAULT 0 CHECK(reserved_bytes>=0),
  upload_token TEXT,
  compute_token TEXT,
  compute_until INTEGER NOT NULL DEFAULT 0
);
```

## marker_studio_materials

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 |
| asset_id | TEXT | False | None | 0 |
| content_version | INTEGER | True | None | 0 |
| document | TEXT | True | None | 0 |

```sql
CREATE TABLE marker_studio_materials (
  id TEXT PRIMARY KEY,
  asset_id TEXT REFERENCES marker_studio_assets(id) ON DELETE RESTRICT,
  content_version INTEGER NOT NULL CHECK(content_version>0),
  document TEXT NOT NULL CHECK(json_valid(document))
);
```

| From | Table | To | On delete |
| --- | --- | --- | --- |
| asset_id | marker_studio_assets | id | RESTRICT |

## marker_studio_meta

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | INTEGER | False | None | 1 |
| revision | INTEGER | True | None | 0 |
| write_token | TEXT | False | None | 0 |

```sql
CREATE TABLE marker_studio_meta (
  id INTEGER PRIMARY KEY CHECK(id=1),
  revision INTEGER NOT NULL CHECK(revision>=0)
, write_token TEXT);
```

## marker_studio_settings

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | INTEGER | False | None | 1 |
| revision | INTEGER | True | 0 | 0 |
| monthly_budget_cents | INTEGER | True | 2000 | 0 |
| processing_budget_cents | INTEGER | True | 1000 | 0 |
| ai_budget_cents | INTEGER | True | 0 | 0 |
| storage_limit_bytes | INTEGER | True | 2147483648 | 0 |
| default_duration_seconds | INTEGER | True | 20 | 0 |

```sql
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
```

## marker_studio_uploads

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 |
| status | TEXT | True | None | 0 |
| document | TEXT | True | None | 0 |
| lock_token | TEXT | False | None | 0 |
| lock_until | INTEGER | True | 0 | 0 |

```sql
CREATE TABLE marker_studio_uploads (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK(status IN ('uploading','completed','cancelled')),
  document TEXT NOT NULL CHECK(json_valid(document))
, lock_token TEXT, lock_until INTEGER NOT NULL DEFAULT 0);
```

## marker_studio_variants

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 |
| campaign_id | TEXT | True | None | 0 |
| recipe_revision | INTEGER | True | None | 0 |
| document | TEXT | True | None | 0 |

```sql
CREATE TABLE marker_studio_variants (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES marker_studio_campaigns(id) ON DELETE RESTRICT,
  recipe_revision INTEGER NOT NULL CHECK(recipe_revision>0),
  document TEXT NOT NULL CHECK(json_valid(document))
);
```

| From | Table | To | On delete |
| --- | --- | --- | --- |
| campaign_id | marker_studio_campaigns | id | RESTRICT |

## marker_workspace

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | INTEGER | False | None | 1 |
| revision | INTEGER | True | None | 0 |
| document | TEXT | True | None | 0 |

```sql
CREATE TABLE marker_workspace (id INTEGER PRIMARY KEY CHECK(id = 1), revision INTEGER NOT NULL CHECK(revision > 0), document TEXT NOT NULL CHECK(length(CAST(document AS BLOB)) <= 1048576 AND json_valid(document)));
```

## Triggers

| Trigger | Table |
| --- | --- |
| marker_account_deleted_permanent | marker_account_lifecycle |
| marker_agent_connections_account_insert | marker_agent_connections |
| marker_agent_connections_account_update | marker_agent_connections |
| marker_agent_events_account_insert | marker_agent_events |
| marker_agent_events_account_update | marker_agent_events |
| marker_agent_meta_account_insert | marker_agent_meta |
| marker_agent_meta_account_update | marker_agent_meta |
| marker_agent_proposals_account_insert | marker_agent_proposals |
| marker_agent_proposals_account_update | marker_agent_proposals |
| marker_agent_runs_account_insert | marker_agent_runs |
| marker_agent_runs_account_update | marker_agent_runs |
| marker_agent_sessions_account_insert | marker_agent_sessions |
| marker_agent_sessions_account_update | marker_agent_sessions |
| marker_auth_challenges_account_insert | marker_auth_challenges |
| marker_auth_challenges_account_update | marker_auth_challenges |
| marker_auth_identities_account_insert | marker_auth_identities |
| marker_auth_identities_account_update | marker_auth_identities |
| marker_auth_limits_account_insert | marker_auth_limits |
| marker_auth_limits_account_update | marker_auth_limits |
| marker_auth_oauth_flows_account_insert | marker_auth_oauth_flows |
| marker_auth_oauth_flows_account_update | marker_auth_oauth_flows |
| marker_auth_oauth_limits_account_insert | marker_auth_oauth_limits |
| marker_auth_oauth_limits_account_update | marker_auth_oauth_limits |
| marker_auth_operator_account_insert | marker_auth_operator |
| marker_auth_operator_account_update | marker_auth_operator |
| marker_auth_principals_account_insert | marker_auth_principals |
| marker_auth_principals_account_update | marker_auth_principals |
| marker_auth_sessions_account_insert | marker_auth_sessions |
| marker_auth_sessions_account_update | marker_auth_sessions |
| marker_mcp_clients_active_insert | marker_mcp_clients |
| marker_mcp_clients_active_update | marker_mcp_clients |
| marker_mcp_codes_active_insert | marker_mcp_codes |
| marker_mcp_codes_active_update | marker_mcp_codes |
| marker_mcp_effects_active_insert | marker_mcp_effects |
| marker_mcp_effects_active_update | marker_mcp_effects |
| marker_mcp_grants_active_insert | marker_mcp_grants |
| marker_mcp_grants_active_update | marker_mcp_grants |
| marker_mcp_limits_active_insert | marker_mcp_limits |
| marker_mcp_limits_active_update | marker_mcp_limits |
| marker_mcp_login_requests_active_insert | marker_mcp_login_requests |
| marker_mcp_login_requests_active_update | marker_mcp_login_requests |
| marker_mcp_requests_active_insert | marker_mcp_requests |
| marker_mcp_requests_active_update | marker_mcp_requests |
| marker_mcp_tokens_active_insert | marker_mcp_tokens |
| marker_mcp_tokens_active_update | marker_mcp_tokens |
| marker_profile_account_insert | marker_profile |
| marker_profile_account_update | marker_profile |
| marker_studio_analysis_account_insert | marker_studio_analysis |
| marker_studio_analysis_account_update | marker_studio_analysis |
| marker_studio_assets_account_insert | marker_studio_assets |
| marker_studio_assets_account_update | marker_studio_assets |
| marker_studio_campaigns_account_insert | marker_studio_campaigns |
| marker_studio_campaigns_account_update | marker_studio_campaigns |
| marker_studio_compute_account_insert | marker_studio_compute |
| marker_studio_compute_account_update | marker_studio_compute |
| marker_studio_jobs_account_insert | marker_studio_jobs |
| marker_studio_jobs_account_update | marker_studio_jobs |
| marker_studio_limits_account_insert | marker_studio_limits |
| marker_studio_limits_account_update | marker_studio_limits |
| marker_studio_materials_account_insert | marker_studio_materials |
| marker_studio_materials_account_update | marker_studio_materials |
| marker_studio_meta_account_insert | marker_studio_meta |
| marker_studio_meta_account_update | marker_studio_meta |
| marker_studio_settings_account_insert | marker_studio_settings |
| marker_studio_settings_account_update | marker_studio_settings |
| marker_studio_uploads_account_insert | marker_studio_uploads |
| marker_studio_uploads_account_update | marker_studio_uploads |
| marker_studio_variants_account_insert | marker_studio_variants |
| marker_studio_variants_account_update | marker_studio_variants |
| marker_workspace_account_insert | marker_workspace |
| marker_workspace_account_update | marker_workspace |

Full trigger/index DDL remains in the linked catalog. Implicit SQLite indexes can have no standalone DDL. JSON fields use domain types. The local-studio catalog covers its constructor only; local Agents/MCP/auth have separate stores and included adapter/migration contracts.
