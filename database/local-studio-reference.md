# Loopback Studio SQLite structural reference

Schema was reconstructed from tracked static SQL in an empty in-memory SQLite database, then replayed from exported schema-only DDL. No hosted or ordinary local database, account record, media, session or workspace content was read. Migration seed statements run only in memory; the exported SQL contains no rows or INSERTs.

Source SQL hashes in the JSON catalog refer to the exact SQL input text, while the complete source-file hashes are in the source snapshot manifest.

| Table | Columns | Foreign keys | Indexes incl. implicit |
| --- | --- | --- | --- |
| [studio_analysis](#studio_analysis) | 11 | 1 | 2 |
| [studio_asset_files](#studio_asset_files) | 2 | 1 | 2 |
| [studio_assets](#studio_assets) | 3 | 0 | 2 |
| [studio_campaigns](#studio_campaigns) | 2 | 0 | 1 |
| [studio_jobs](#studio_jobs) | 4 | 0 | 2 |
| [studio_materials](#studio_materials) | 2 | 0 | 1 |
| [studio_meta](#studio_meta) | 2 | 0 | 0 |
| [studio_settings](#studio_settings) | 2 | 0 | 0 |
| [studio_uploads](#studio_uploads) | 2 | 0 | 1 |
| [studio_variants](#studio_variants) | 3 | 0 | 1 |

Tables: 10; columns: 33; explicit indexes: 3; triggers: 0. SQLite catalog version: 3.49.1.

[Schema-only DDL](local-studio-schema.sql) · [Machine-readable catalog](local-studio-catalog.json)

## Sources

- `server/studio-local.ts:L106-L120` — static initialization SQL template.

## studio_analysis

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
| reserved_bytes | INTEGER | True | 0 | 0 | 0 |
| metadata_reserved | INTEGER | True | 0 | 0 | 0 |

Foreign keys:

| From | Referenced table | To | On update | On delete |
| --- | --- | --- | --- | --- |
| asset_id | studio_assets | id | NO ACTION | NO ACTION |

Indexes:

| Name | Unique | Origin | Partial | Key columns |
| --- | --- | --- | --- | --- |
| studio_analysis_cache | True | c | True | sha256, start_ms, end_ms, profile, tool_version |
| sqlite_autoindex_studio_analysis_1 | True | pk | False | id |

DDL (including CHECK, UNIQUE and foreign-key constraints):

```sql
CREATE TABLE studio_analysis(id TEXT PRIMARY KEY,asset_id TEXT NOT NULL REFERENCES studio_assets(id),sha256 TEXT NOT NULL,start_ms INTEGER NOT NULL,end_ms INTEGER NOT NULL,profile TEXT NOT NULL,tool_version TEXT NOT NULL,status TEXT NOT NULL,document TEXT NOT NULL,reserved_bytes INTEGER NOT NULL DEFAULT 0,metadata_reserved INTEGER NOT NULL DEFAULT 0);
```

## studio_asset_files

| Column | SQL type | Not null | Default | PK ordinal | Hidden |
| --- | --- | --- | --- | --- | --- |
| asset_id | TEXT | False | None | 1 | 0 |
| storage_key | TEXT | True | None | 0 | 0 |

Foreign keys:

| From | Referenced table | To | On update | On delete |
| --- | --- | --- | --- | --- |
| asset_id | studio_assets | id | NO ACTION | NO ACTION |

Indexes:

| Name | Unique | Origin | Partial | Key columns |
| --- | --- | --- | --- | --- |
| sqlite_autoindex_studio_asset_files_2 | True | u | False | storage_key |
| sqlite_autoindex_studio_asset_files_1 | True | pk | False | asset_id |

DDL (including CHECK, UNIQUE and foreign-key constraints):

```sql
CREATE TABLE studio_asset_files(asset_id TEXT PRIMARY KEY REFERENCES studio_assets(id),storage_key TEXT NOT NULL UNIQUE);
```

## studio_assets

| Column | SQL type | Not null | Default | PK ordinal | Hidden |
| --- | --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 | 0 |
| sha256 | TEXT | True | None | 0 | 0 |
| document | TEXT | True | None | 0 | 0 |

Indexes:

| Name | Unique | Origin | Partial | Key columns |
| --- | --- | --- | --- | --- |
| studio_assets_hash | False | c | False | sha256 |
| sqlite_autoindex_studio_assets_1 | True | pk | False | id |

DDL (including CHECK, UNIQUE and foreign-key constraints):

```sql
CREATE TABLE studio_assets(id TEXT PRIMARY KEY,sha256 TEXT NOT NULL,document TEXT NOT NULL);
```

## studio_campaigns

| Column | SQL type | Not null | Default | PK ordinal | Hidden |
| --- | --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 | 0 |
| document | TEXT | True | None | 0 | 0 |

Indexes:

| Name | Unique | Origin | Partial | Key columns |
| --- | --- | --- | --- | --- |
| sqlite_autoindex_studio_campaigns_1 | True | pk | False | id |

DDL (including CHECK, UNIQUE and foreign-key constraints):

```sql
CREATE TABLE studio_campaigns(id TEXT PRIMARY KEY,document TEXT NOT NULL);
```

## studio_jobs

| Column | SQL type | Not null | Default | PK ordinal | Hidden |
| --- | --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 | 0 |
| variant_id | TEXT | True | None | 0 | 0 |
| recipe_revision | INTEGER | True | None | 0 | 0 |
| document | TEXT | True | None | 0 | 0 |

Indexes:

| Name | Unique | Origin | Partial | Key columns |
| --- | --- | --- | --- | --- |
| studio_jobs_recipe | False | c | False | variant_id, recipe_revision |
| sqlite_autoindex_studio_jobs_1 | True | pk | False | id |

DDL (including CHECK, UNIQUE and foreign-key constraints):

```sql
CREATE TABLE studio_jobs(id TEXT PRIMARY KEY,variant_id TEXT NOT NULL,recipe_revision INTEGER NOT NULL,document TEXT NOT NULL);
```

## studio_materials

| Column | SQL type | Not null | Default | PK ordinal | Hidden |
| --- | --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 | 0 |
| document | TEXT | True | None | 0 | 0 |

Indexes:

| Name | Unique | Origin | Partial | Key columns |
| --- | --- | --- | --- | --- |
| sqlite_autoindex_studio_materials_1 | True | pk | False | id |

DDL (including CHECK, UNIQUE and foreign-key constraints):

```sql
CREATE TABLE studio_materials(id TEXT PRIMARY KEY,document TEXT NOT NULL);
```

## studio_meta

| Column | SQL type | Not null | Default | PK ordinal | Hidden |
| --- | --- | --- | --- | --- | --- |
| id | INTEGER | False | None | 1 | 0 |
| revision | INTEGER | True | None | 0 | 0 |

DDL (including CHECK, UNIQUE and foreign-key constraints):

```sql
CREATE TABLE studio_meta(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL);
```

## studio_settings

| Column | SQL type | Not null | Default | PK ordinal | Hidden |
| --- | --- | --- | --- | --- | --- |
| id | INTEGER | False | None | 1 | 0 |
| document | TEXT | True | None | 0 | 0 |

DDL (including CHECK, UNIQUE and foreign-key constraints):

```sql
CREATE TABLE studio_settings(id INTEGER PRIMARY KEY CHECK(id=1),document TEXT NOT NULL CHECK(json_valid(document)));
```

## studio_uploads

| Column | SQL type | Not null | Default | PK ordinal | Hidden |
| --- | --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 | 0 |
| document | TEXT | True | None | 0 | 0 |

Indexes:

| Name | Unique | Origin | Partial | Key columns |
| --- | --- | --- | --- | --- |
| sqlite_autoindex_studio_uploads_1 | True | pk | False | id |

DDL (including CHECK, UNIQUE and foreign-key constraints):

```sql
CREATE TABLE studio_uploads(id TEXT PRIMARY KEY,document TEXT NOT NULL);
```

## studio_variants

| Column | SQL type | Not null | Default | PK ordinal | Hidden |
| --- | --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 | 0 |
| campaign_id | TEXT | True | None | 0 | 0 |
| document | TEXT | True | None | 0 | 0 |

Indexes:

| Name | Unique | Origin | Partial | Key columns |
| --- | --- | --- | --- | --- |
| sqlite_autoindex_studio_variants_1 | True | pk | False | id |

DDL (including CHECK, UNIQUE and foreign-key constraints):

```sql
CREATE TABLE studio_variants(id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL,document TEXT NOT NULL);
```

## Constraint interpretation

`PRAGMA table_xinfo` reports declared `NOT NULL` independently of primary-key semantics; use the DDL to interpret `INTEGER PRIMARY KEY` and `WITHOUT ROWID`. SQLite implicit primary-key/unique indexes are catalogued where PRAGMA reports them, even when they have no standalone sqlite_schema SQL. Expression/partial indexes retain their exact DDL in the JSON and SQL files. JSON documents have application-level fields beyond these relational columns; see the TypeScript domain and Studio type surfaces. The schema alone does not prove runtime mappings, migrations applied remotely, permissions, retention, timing or data validity.
