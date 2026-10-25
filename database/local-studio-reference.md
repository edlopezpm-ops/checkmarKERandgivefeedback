# Local Studio initialization schema

10 tables; 33 columns; 3 explicit indexes; 0 triggers. Applied to an empty in-memory SQLite database and replayed from schema-only DDL. No runtime database or owner records were read. This does not establish remote migration state.

[SQL](local-studio-schema.sql) · [Catalog](local-studio-catalog.json)

| Table | Columns | Foreign keys | Indexes |
| --- | --- | --- | --- |
| studio_analysis | 11 | 1 | 2 |
| studio_asset_files | 2 | 1 | 2 |
| studio_assets | 3 | 0 | 2 |
| studio_campaigns | 2 | 0 | 1 |
| studio_jobs | 4 | 0 | 2 |
| studio_materials | 2 | 0 | 1 |
| studio_meta | 2 | 0 | 0 |
| studio_settings | 2 | 0 | 0 |
| studio_uploads | 2 | 0 | 1 |
| studio_variants | 3 | 0 | 1 |

## Inputs

- [server/studio-local.ts](../source/server/studio-local.ts)

## studio_analysis

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
| reserved_bytes | INTEGER | True | 0 | 0 |
| metadata_reserved | INTEGER | True | 0 | 0 |

```sql
CREATE TABLE studio_analysis(id TEXT PRIMARY KEY,asset_id TEXT NOT NULL REFERENCES studio_assets(id),sha256 TEXT NOT NULL,start_ms INTEGER NOT NULL,end_ms INTEGER NOT NULL,profile TEXT NOT NULL,tool_version TEXT NOT NULL,status TEXT NOT NULL,document TEXT NOT NULL,reserved_bytes INTEGER NOT NULL DEFAULT 0,metadata_reserved INTEGER NOT NULL DEFAULT 0);
```

| From | Table | To | On delete |
| --- | --- | --- | --- |
| asset_id | studio_assets | id | NO ACTION |

## studio_asset_files

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| asset_id | TEXT | False | None | 1 |
| storage_key | TEXT | True | None | 0 |

```sql
CREATE TABLE studio_asset_files(asset_id TEXT PRIMARY KEY REFERENCES studio_assets(id),storage_key TEXT NOT NULL UNIQUE);
```

| From | Table | To | On delete |
| --- | --- | --- | --- |
| asset_id | studio_assets | id | NO ACTION |

## studio_assets

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 |
| sha256 | TEXT | True | None | 0 |
| document | TEXT | True | None | 0 |

```sql
CREATE TABLE studio_assets(id TEXT PRIMARY KEY,sha256 TEXT NOT NULL,document TEXT NOT NULL);
```

## studio_campaigns

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 |
| document | TEXT | True | None | 0 |

```sql
CREATE TABLE studio_campaigns(id TEXT PRIMARY KEY,document TEXT NOT NULL);
```

## studio_jobs

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 |
| variant_id | TEXT | True | None | 0 |
| recipe_revision | INTEGER | True | None | 0 |
| document | TEXT | True | None | 0 |

```sql
CREATE TABLE studio_jobs(id TEXT PRIMARY KEY,variant_id TEXT NOT NULL,recipe_revision INTEGER NOT NULL,document TEXT NOT NULL);
```

## studio_materials

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 |
| document | TEXT | True | None | 0 |

```sql
CREATE TABLE studio_materials(id TEXT PRIMARY KEY,document TEXT NOT NULL);
```

## studio_meta

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | INTEGER | False | None | 1 |
| revision | INTEGER | True | None | 0 |

```sql
CREATE TABLE studio_meta(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL);
```

## studio_settings

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | INTEGER | False | None | 1 |
| document | TEXT | True | None | 0 |

```sql
CREATE TABLE studio_settings(id INTEGER PRIMARY KEY CHECK(id=1),document TEXT NOT NULL CHECK(json_valid(document)));
```

## studio_uploads

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 |
| document | TEXT | True | None | 0 |

```sql
CREATE TABLE studio_uploads(id TEXT PRIMARY KEY,document TEXT NOT NULL);
```

## studio_variants

| Column | Type | Not null | Default | PK |
| --- | --- | --- | --- | --- |
| id | TEXT | False | None | 1 |
| campaign_id | TEXT | True | None | 0 |
| document | TEXT | True | None | 0 |

```sql
CREATE TABLE studio_variants(id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL,document TEXT NOT NULL);
```

## Triggers

| Trigger | Table |
| --- | --- |

Full trigger/index DDL remains in the linked catalog. Implicit SQLite indexes can have no standalone DDL. JSON fields use domain types. The local-studio catalog covers its constructor only; local Agents/MCP/auth have separate stores and included adapter/migration contracts.
