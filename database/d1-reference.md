# Cloudflare D1 structural reference

Schema was reconstructed from tracked static SQL in an empty in-memory SQLite database, then replayed from exported schema-only DDL. No hosted or ordinary local database, account record, media, session or workspace content was read. Migration seed statements run only in memory; the exported SQL contains no rows or INSERTs.

Source SQL hashes in the JSON catalog refer to the exact SQL input text, while the complete source-file hashes are in the source snapshot manifest.

| Table | Columns | Foreign keys | Indexes incl. implicit |
| --- | --- | --- | --- |
| [marker_auth_challenges](#marker_auth_challenges) | 7 | 0 | 1 |
| [marker_auth_limits](#marker_auth_limits) | 5 | 0 | 1 |
| [marker_auth_sessions](#marker_auth_sessions) | 5 | 0 | 1 |
| [marker_studio_analysis](#marker_studio_analysis) | 13 | 1 | 4 |
| [marker_studio_assets](#marker_studio_assets) | 6 | 0 | 3 |
| [marker_studio_campaigns](#marker_studio_campaigns) | 3 | 0 | 1 |
| [marker_studio_compute](#marker_studio_compute) | 3 | 0 | 1 |
| [marker_studio_jobs](#marker_studio_jobs) | 8 | 1 | 3 |
| [marker_studio_limits](#marker_studio_limits) | 6 | 0 | 0 |
| [marker_studio_materials](#marker_studio_materials) | 4 | 1 | 1 |
| [marker_studio_meta](#marker_studio_meta) | 3 | 0 | 0 |
| [marker_studio_settings](#marker_studio_settings) | 7 | 0 | 0 |
| [marker_studio_uploads](#marker_studio_uploads) | 5 | 0 | 2 |
| [marker_studio_variants](#marker_studio_variants) | 4 | 1 | 2 |
| [marker_workspace](#marker_workspace) | 3 | 0 | 0 |

Tables: 15; columns: 82; explicit indexes: 8; triggers: 0. SQLite catalog version: 3.49.1.

[Schema-only DDL](d1-schema.sql) · [Machine-readable catalog](d1-catalog.json)

## Sources

- `migrations-d1/0001_private.sql:L1-L26`
- `migrations-d1/0002_studio.sql:L1-L49`
- `migrations-d1/0003_studio_hosted.sql:L1-L23`
- `migrations-d1/0004_studio_analysis.sql:L1-L20`
- `migrations-d1/0005_studio_settings.sql:L1-L13`

## marker_auth_challenges

| Column | SQL type | Not null | Default | PK ordinal | Hidden |
| --- | --- | --- | --- | --- | --- |
| challenge_hash | TEXT | True | None | 1 | 0 |
| owner_hash | TEXT | True | None | 0 | 0 |
| code_hash | TEXT | True | None | 0 | 0 |
| created_at | INTEGER | True | None | 0 | 0 |
| expires_at | INTEGER | True | None | 0 | 0 |
| attempts | INTEGER | True | 0 | 0 | 0 |
| consumed_at | INTEGER | False | None | 0 | 0 |

Indexes:

| Name | Unique | Origin | Partial | Key columns |
| --- | --- | --- | --- | --- |
| sqlite_autoindex_marker_auth_challenges_1 | True | pk | False | challenge_hash |

DDL (including CHECK, UNIQUE and foreign-key constraints):

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

## marker_auth_limits

| Column | SQL type | Not null | Default | PK ordinal | Hidden |
| --- | --- | --- | --- | --- | --- |
| key | TEXT | True | None | 1 | 0 |
| window_start | INTEGER | True | None | 0 | 0 |
| count | INTEGER | True | None | 0 | 0 |
| last_at | INTEGER | True | None | 0 | 0 |
| ticket | TEXT | True | None | 0 | 0 |

Indexes:

| Name | Unique | Origin | Partial | Key columns |
| --- | --- | --- | --- | --- |
| sqlite_autoindex_marker_auth_limits_1 | True | pk | False | key |

DDL (including CHECK, UNIQUE and foreign-key constraints):

```sql
CREATE TABLE marker_auth_limits (
  key TEXT PRIMARY KEY CHECK (length(key) = 64),
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL CHECK (count > 0 AND count <= 100),
  last_at INTEGER NOT NULL,
  ticket TEXT NOT NULL CHECK (length(ticket) = 64)
) WITHOUT ROWID;
```

## marker_auth_sessions

| Column | SQL type | Not null | Default | PK ordinal | Hidden |
| --- | --- | --- | --- | --- | --- |
| session_hash | TEXT | True | None | 1 | 0 |
| owner_hash | TEXT | True | None | 0 | 0 |
| created_at | INTEGER | True | None | 0 | 0 |
| expires_at | INTEGER | True | None | 0 | 0 |
| last_seen | INTEGER | True | None | 0 | 0 |

Indexes:

| Name | Unique | Origin | Partial | Key columns |
| --- | --- | --- | --- | --- |
| sqlite_autoindex_marker_auth_sessions_1 | True | pk | False | session_hash |

DDL (including CHECK, UNIQUE and foreign-key constraints):

```sql
CREATE TABLE marker_auth_sessions (
  session_hash TEXT PRIMARY KEY CHECK (length(session_hash) = 64),
  owner_hash TEXT NOT NULL CHECK (length(owner_hash) = 64),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at = created_at + 21600),
  last_seen INTEGER NOT NULL
) WITHOUT ROWID;
```

## marker_studio_analysis

| Column | SQL type | Not null | Default | PK ordinal | Hidden |
| --- | --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 | 0 |
| asset_id | TEXT | True | None | 0 | 0 |
| sha256 | TEXT | True | None | 0 | 0 |
| start_ms | INTEGER | True | None | 0 | 0 |
| end_ms | INTEGER | True | None | 0 | 0 |
| profile | TEXT | True | None | 0 | 0 |
| tool_version | TEXT | True | None | 0 | 0 |
| status | TEXT | True | None | 0 | 0 |
| document | TEXT | True | None | 0 | 0 |
| lock_token | TEXT | False | None | 0 | 0 |
| lock_until | INTEGER | True | 0 | 0 | 0 |
| reserved_bytes | INTEGER | True | 0 | 0 | 0 |
| metadata_reserved | INTEGER | True | 0 | 0 | 0 |

Foreign keys:

| From | Referenced table | To | On update | On delete |
| --- | --- | --- | --- | --- |
| asset_id | marker_studio_assets | id | NO ACTION | RESTRICT |

Indexes:

| Name | Unique | Origin | Partial | Key columns |
| --- | --- | --- | --- | --- |
| marker_studio_analysis_status | False | c | False | status |
| marker_studio_analysis_asset | False | c | False | asset_id |
| marker_studio_analysis_cache | True | c | True | sha256, start_ms, end_ms, profile, tool_version |
| sqlite_autoindex_marker_studio_analysis_1 | True | pk | False | id |

DDL (including CHECK, UNIQUE and foreign-key constraints):

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

## marker_studio_assets

| Column | SQL type | Not null | Default | PK ordinal | Hidden |
| --- | --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 | 0 |
| sha256 | TEXT | True | None | 0 | 0 |
| kind | TEXT | True | None | 0 | 0 |
| size_bytes | INTEGER | True | None | 0 | 0 |
| storage_key | TEXT | True | None | 0 | 0 |
| document | TEXT | True | None | 0 | 0 |

Indexes:

| Name | Unique | Origin | Partial | Key columns |
| --- | --- | --- | --- | --- |
| marker_studio_assets_hash | False | c | False | sha256 |
| sqlite_autoindex_marker_studio_assets_2 | True | u | False | storage_key |
| sqlite_autoindex_marker_studio_assets_1 | True | pk | False | id |

DDL (including CHECK, UNIQUE and foreign-key constraints):

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

| Column | SQL type | Not null | Default | PK ordinal | Hidden |
| --- | --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 | 0 |
| product_id | TEXT | True | None | 0 | 0 |
| document | TEXT | True | None | 0 | 0 |

Indexes:

| Name | Unique | Origin | Partial | Key columns |
| --- | --- | --- | --- | --- |
| sqlite_autoindex_marker_studio_campaigns_1 | True | pk | False | id |

DDL (including CHECK, UNIQUE and foreign-key constraints):

```sql
CREATE TABLE marker_studio_campaigns (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  document TEXT NOT NULL CHECK(json_valid(document))
);
```

## marker_studio_compute

| Column | SQL type | Not null | Default | PK ordinal | Hidden |
| --- | --- | --- | --- | --- | --- |
| month | TEXT | False | None | 1 | 0 |
| used_cents | INTEGER | True | 0 | 0 | 0 |
| last_token | TEXT | False | None | 0 | 0 |

Indexes:

| Name | Unique | Origin | Partial | Key columns |
| --- | --- | --- | --- | --- |
| sqlite_autoindex_marker_studio_compute_1 | True | pk | False | month |

DDL (including CHECK, UNIQUE and foreign-key constraints):

```sql
CREATE TABLE marker_studio_compute (
  month TEXT PRIMARY KEY CHECK(length(month)=7),
  used_cents INTEGER NOT NULL DEFAULT 0 CHECK(used_cents>=0),
  last_token TEXT
);
```

## marker_studio_jobs

| Column | SQL type | Not null | Default | PK ordinal | Hidden |
| --- | --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 | 0 |
| variant_id | TEXT | True | None | 0 | 0 |
| recipe_revision | INTEGER | True | None | 0 | 0 |
| status | TEXT | True | None | 0 | 0 |
| document | TEXT | True | None | 0 | 0 |
| lock_token | TEXT | False | None | 0 | 0 |
| lock_until | INTEGER | True | 0 | 0 | 0 |
| reserved_bytes | INTEGER | True | 0 | 0 | 0 |

Foreign keys:

| From | Referenced table | To | On update | On delete |
| --- | --- | --- | --- | --- |
| variant_id | marker_studio_variants | id | NO ACTION | RESTRICT |

Indexes:

| Name | Unique | Origin | Partial | Key columns |
| --- | --- | --- | --- | --- |
| marker_studio_one_render | True | c | True | <expression/rowid> |
| marker_studio_jobs_recipe | False | c | False | variant_id, recipe_revision |
| sqlite_autoindex_marker_studio_jobs_1 | True | pk | False | id |

DDL (including CHECK, UNIQUE and foreign-key constraints):

```sql
CREATE TABLE marker_studio_jobs (
  id TEXT PRIMARY KEY,
  variant_id TEXT NOT NULL REFERENCES marker_studio_variants(id) ON DELETE RESTRICT,
  recipe_revision INTEGER NOT NULL CHECK(recipe_revision>0),
  status TEXT NOT NULL CHECK(status IN ('queued','running','completed','failed')),
  document TEXT NOT NULL CHECK(json_valid(document))
, lock_token TEXT, lock_until INTEGER NOT NULL DEFAULT 0, reserved_bytes INTEGER NOT NULL DEFAULT 0 CHECK(reserved_bytes>=0));
```

## marker_studio_limits

| Column | SQL type | Not null | Default | PK ordinal | Hidden |
| --- | --- | --- | --- | --- | --- |
| id | INTEGER | False | None | 1 | 0 |
| stored_bytes | INTEGER | True | 0 | 0 | 0 |
| reserved_bytes | INTEGER | True | 0 | 0 | 0 |
| upload_token | TEXT | False | None | 0 | 0 |
| compute_token | TEXT | False | None | 0 | 0 |
| compute_until | INTEGER | True | 0 | 0 | 0 |

DDL (including CHECK, UNIQUE and foreign-key constraints):

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

| Column | SQL type | Not null | Default | PK ordinal | Hidden |
| --- | --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 | 0 |
| asset_id | TEXT | False | None | 0 | 0 |
| content_version | INTEGER | True | None | 0 | 0 |
| document | TEXT | True | None | 0 | 0 |

Foreign keys:

| From | Referenced table | To | On update | On delete |
| --- | --- | --- | --- | --- |
| asset_id | marker_studio_assets | id | NO ACTION | RESTRICT |

Indexes:

| Name | Unique | Origin | Partial | Key columns |
| --- | --- | --- | --- | --- |
| sqlite_autoindex_marker_studio_materials_1 | True | pk | False | id |

DDL (including CHECK, UNIQUE and foreign-key constraints):

```sql
CREATE TABLE marker_studio_materials (
  id TEXT PRIMARY KEY,
  asset_id TEXT REFERENCES marker_studio_assets(id) ON DELETE RESTRICT,
  content_version INTEGER NOT NULL CHECK(content_version>0),
  document TEXT NOT NULL CHECK(json_valid(document))
);
```

## marker_studio_meta

| Column | SQL type | Not null | Default | PK ordinal | Hidden |
| --- | --- | --- | --- | --- | --- |
| id | INTEGER | False | None | 1 | 0 |
| revision | INTEGER | True | None | 0 | 0 |
| write_token | TEXT | False | None | 0 | 0 |

DDL (including CHECK, UNIQUE and foreign-key constraints):

```sql
CREATE TABLE marker_studio_meta (
  id INTEGER PRIMARY KEY CHECK(id=1),
  revision INTEGER NOT NULL CHECK(revision>=0)
, write_token TEXT);
```

## marker_studio_settings

| Column | SQL type | Not null | Default | PK ordinal | Hidden |
| --- | --- | --- | --- | --- | --- |
| id | INTEGER | False | None | 1 | 0 |
| revision | INTEGER | True | 0 | 0 | 0 |
| monthly_budget_cents | INTEGER | True | 2000 | 0 | 0 |
| processing_budget_cents | INTEGER | True | 1000 | 0 | 0 |
| ai_budget_cents | INTEGER | True | 0 | 0 | 0 |
| storage_limit_bytes | INTEGER | True | 2147483648 | 0 | 0 |
| default_duration_seconds | INTEGER | True | 20 | 0 | 0 |

DDL (including CHECK, UNIQUE and foreign-key constraints):

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

| Column | SQL type | Not null | Default | PK ordinal | Hidden |
| --- | --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 | 0 |
| status | TEXT | True | None | 0 | 0 |
| document | TEXT | True | None | 0 | 0 |
| lock_token | TEXT | False | None | 0 | 0 |
| lock_until | INTEGER | True | 0 | 0 | 0 |

Indexes:

| Name | Unique | Origin | Partial | Key columns |
| --- | --- | --- | --- | --- |
| marker_studio_one_upload | True | c | True | status |
| sqlite_autoindex_marker_studio_uploads_1 | True | pk | False | id |

DDL (including CHECK, UNIQUE and foreign-key constraints):

```sql
CREATE TABLE marker_studio_uploads (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK(status IN ('uploading','completed','cancelled')),
  document TEXT NOT NULL CHECK(json_valid(document))
, lock_token TEXT, lock_until INTEGER NOT NULL DEFAULT 0);
```

## marker_studio_variants

| Column | SQL type | Not null | Default | PK ordinal | Hidden |
| --- | --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 | 0 |
| campaign_id | TEXT | True | None | 0 | 0 |
| recipe_revision | INTEGER | True | None | 0 | 0 |
| document | TEXT | True | None | 0 | 0 |

Foreign keys:

| From | Referenced table | To | On update | On delete |
| --- | --- | --- | --- | --- |
| campaign_id | marker_studio_campaigns | id | NO ACTION | RESTRICT |

Indexes:

| Name | Unique | Origin | Partial | Key columns |
| --- | --- | --- | --- | --- |
| marker_studio_variants_campaign | False | c | False | campaign_id |
| sqlite_autoindex_marker_studio_variants_1 | True | pk | False | id |

DDL (including CHECK, UNIQUE and foreign-key constraints):

```sql
CREATE TABLE marker_studio_variants (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES marker_studio_campaigns(id) ON DELETE RESTRICT,
  recipe_revision INTEGER NOT NULL CHECK(recipe_revision>0),
  document TEXT NOT NULL CHECK(json_valid(document))
);
```

## marker_workspace

| Column | SQL type | Not null | Default | PK ordinal | Hidden |
| --- | --- | --- | --- | --- | --- |
| id | INTEGER | False | None | 1 | 0 |
| revision | INTEGER | True | None | 0 | 0 |
| document | TEXT | True | None | 0 | 0 |

DDL (including CHECK, UNIQUE and foreign-key constraints):

```sql
CREATE TABLE marker_workspace (id INTEGER PRIMARY KEY CHECK(id = 1), revision INTEGER NOT NULL CHECK(revision > 0), document TEXT NOT NULL CHECK(length(CAST(document AS BLOB)) <= 1048576 AND json_valid(document)));
```

## Constraint interpretation

`PRAGMA table_xinfo` reports declared `NOT NULL` independently of primary-key semantics; use the DDL to interpret `INTEGER PRIMARY KEY` and `WITHOUT ROWID`. SQLite implicit primary-key/unique indexes are catalogued where PRAGMA reports them, even when they have no standalone sqlite_schema SQL. Expression/partial indexes retain their exact DDL in the JSON and SQL files. JSON documents have application-level fields beyond these relational columns; see the TypeScript domain and Studio type surfaces. The schema alone does not prove runtime mappings, migrations applied remotely, permissions, retention, timing or data validity.
