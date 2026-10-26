# 11 — Database and catalog reference

Current source at `77bbedac` includes the D1 migration sequence through [0013_analytics_subject.sql](source/migrations-d1/0013_analytics_subject.sql). The latest two additions are [0012_policy_acknowledgements.sql](source/migrations-d1/0012_policy_acknowledgements.sql), for deliberate versioned service declarations, and 0013 for central rights-routing identity/receipt. No owner rows or runtime database files are published.

| Reference | Contents |
| --- | --- |
| [D1 catalog](database/d1-reference.md) | Current tables, columns, keys, indexes, trigger names and migration provenance. |
| [D1 schema](database/d1-schema.sql) | Empty schema DDL, without owner records. |
| [D1 JSON](database/d1-catalog.json) | Structured schema metadata and exact input provenance. |
| [Local Studio catalog](database/local-studio-reference.md) | Local constructor SQL reconstructed separately. |
| [Supabase reference](database/supabase-reference.md) | Inactive PostgreSQL editorial adapter, separately qualified. |

Exact table/column/index/trigger totals come from these regenerated catalogs. The old 24 October 36-table narrative is historical and does not override current generated metadata. Local auth, Agents and MCP use separate stores; local Studio totals are not the hosted schema totals.

Catalog generation replays SQL into empty temporary SQLite databases and checks schema/FK integrity. Migration seeds create only fresh synthetic identities in that reconstruction; exported schema contains no rows. The audit also exercised migrations and selected real SQL transactions, CAS, policy/own-data rights and synthetic deletion failure/retry. Those are separate execution evidence.

Schema structure does not prove remote migration state, actor authorization, provider-side erasure, data validity, performance or restoration. JSON document fields require their application types/validators. Read [policy](source/server/policy.ts), [privacy export](source/server/privacy-data.ts), [profile/lifecycle](source/server/profile.ts), [Analytics](source/server/analytics.ts), [Studio persistence](source/server/studio-hosted.ts) and [MCP store](source/server/mcp-auth-store.ts) with the SQL and [audit limits](12-functional-integrity-audit.md).
