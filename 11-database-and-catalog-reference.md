# 11 — Database and catalog reference

All snapshot D1 migrations, including Agents, retained operator identities, Google/GitHub linking, Profile/account lifecycle and additive MCP grants/effects, were applied to an empty in-memory SQLite database. Exported schema-only DDL was replayed into another empty database and checked for integrity and foreign-key consistency. No live/local runtime database was opened.

The reconstructed D1 application schema has **35 tables, 195 columns, 14 explicit indexes and 69 triggers**. Local Studio initialization has **10 tables and 33 columns**. These are different catalogs; local auth/Agents/MCP use additional separate stores as shown in their adapters.

| Reference | Contents |
| --- | --- |
| [D1 catalog](database/d1-reference.md) | Tables, fields, keys, indexes, trigger names and source migrations. |
| [D1 schema](database/d1-schema.sql) | Empty table/index/trigger DDL, without owner data. |
| [D1 JSON](database/d1-catalog.json) | Structured schema metadata and exact SQL-input provenance. |
| [Local Studio catalog](database/local-studio-reference.md) | Static Studio constructor SQL separately reconstructed. |
| [Supabase reference](database/supabase-reference.md) | Inactive PostgreSQL editorial adapter, separately qualified. |

Migration seed statements create fresh random identities only inside the temporary empty reconstruction; exported DDL contains no rows. Trigger and FK structure does not prove deployed migration state, actor authorization, deletion execution, data validity or query performance. JSON document fields live in application types and validators, beyond SQL columns. Review transaction guards and runtime adapters with the schemas.
