# 02 — Data model and transactions

Current source: 26 October 2026, `77bbedac`. Exact schema quantities come from the regenerated [catalogs](11-database-and-catalog-reference.md).

The [editorial domain](source/src/core/domain.ts) holds products, social-account metadata, text sources, editorial campaigns, destination drafts/posts and recorded outcomes in one versioned Workspace document. [D1Repository](source/server/d1.ts) persists an atomic revision-checked aggregate with a 1 MiB hosted ceiling. [LocalRepository](source/server/local.ts) serializes commands and atomically replaces its local file; one process owns a data path. The [Supabase adapter](source/server/supabase.ts) and [Postgres migration](source/migrations/0001_editorial.sql) are inactive preparation.

Studio uses separate [typed contracts](source/src/core/studio.ts) and normalized persistence: assets retain original-byte identity and technical facts; materials express editable text/classification/rights/review/product associations; campaigns group work; variants contain recipe revisions; jobs retain immutable input/result/provenance receipts; uploads track committed offsets and reservations. Analysis, settings, compute ledgers and history have their own records. Editorial product-reference checks prevent deletion while Studio still depends on that product.

| Version/custody boundary | Why it is separate |
| --- | --- |
| Editorial Workspace revision | Atomic domain commands; HTTP 409 protects a newer workspace. |
| Studio revision | Material/campaign/variant mutations and trusted planner saves. |
| Recipe revision | Render, exact-result approval and export authorization; editing invalidates approval. |
| Settings/Profile revisions | Preferences and profile drafts do not overwrite each other or business content. |
| Agent request/run/effect identity | Reload/replay can reconcile a completed effect without creating another material. |
| MCP grant + request_id + argument digest | Duplicate request admission is scoped and recoverable; domain CAS still applies. |

Planner provenance retains source IDs/versions/hashes, selected ranges, consent, native planner version and fingerprints. Server recomputation prevents a client from inventing eligibility. A trusted local Agent generation receipt carries actual run/model/proposal identity into materials, variants and render receipts. An external MCP request records its client/grant/action, but does not invent the host's model or forge an Agent receipt.

The persisted authentication singleton supplies immutable user/tenant IDs without remapping earlier business records. Profile stores optional display data separately. The account lifecycle freezes writes during confirmed deletion; triggers cover existing domain/auth/Agent tables and all new MCP tables. Connector grants/tokens/requests/receipts start with seven additive tables in [0010_mcp.sql](source/migrations-d1/0010_mcp.sql). [0011_mcp_connections.sql](source/migrations-d1/0011_mcp_connections.sql) adds a nullable authorized-client timestamp and an eighth table for expiring, single-use pending-login correlation. Existing grants backfill authorization time. Approved client identity survives grant expiry/revocation; a login handle itself grants no owner or data access. Account deletion freezes and purges all eight tables.

Read all migration SQL in [source/migrations-d1/](source/migrations-d1/) and the [generated D1 catalog](database/d1-reference.md). Catalog replay verifies empty schema structure, not live D1 rows, remote applied versions, runtime query coverage or restoration. Entity JSON fields must be read with their TypeScript contracts.

[0012_policy_acknowledgements.sql](source/migrations-d1/0012_policy_acknowledgements.sql) adds the user/tenant-bound declaration receipt. [policy.ts](source/server/policy.ts) compares versions and requires deliberate declarations with recent proof; reading a notice or an agent call cannot accept the contract. Own-data export reads bounded declared categories through [privacy-data.ts](source/server/privacy-data.ts), with scope/exclusions in the resulting JSON.

[0013_analytics_subject.sql](source/migrations-d1/0013_analytics_subject.sql) retains a source-scoped subject reference and optional central deletion receipt, without copying central preference/event history. The relay records the rights-routing reference before a first central mutation and refuses closed-account insertion. Local account deletion must resolve the central rights step before purging identity. Real external suppression remains unverified in this audit.

The 26 October audit replayed all 13 D1 migrations in a new SQLite store and exercised CAS, new-connection persistence, bounded export and synthetic deletion retry/freeze. Empty-schema/catalog success does not establish current remote migration state, live data correctness or provider-side erasure.
