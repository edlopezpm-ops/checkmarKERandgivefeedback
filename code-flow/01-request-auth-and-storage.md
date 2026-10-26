# Request, authentication and persistence

Current source: 26 October 2026, `77bbedac`. Hosted [entry](../source/server/entry.ts) → [worker](../source/server/worker.ts) → native auth/retained tenant/account lifecycle → current [service-declaration gate](../source/server/policy.ts) where applicable → family dispatcher → domain validation → revision-checked D1 commit → bounded response. Public static/demo/OAuth discovery and separately defined authentication/data-rights routes have explicit dispatch rules.

Local [Vite](../source/vite.config.ts) loopback guard → local session/API adapters → [file repository](../source/server/local.ts) or [Studio SQLite](../source/server/studio-local.ts). Local access trusts the OS account and uses disposable, separate data for tests.

Email challenge → same-browser proof → opaque session → retained operator. First Google/GitHub linking also requires recent native email proof. [Profile deletion](../source/server/profile.ts) freezes writes before stopping compute and purging stores; current [Analytics](../source/server/analytics.ts) subject/rights routing precedes final identity removal. Read [0009](../source/migrations-d1/0009_profile_account.sql), [0010](../source/migrations-d1/0010_mcp.sql), [0011](../source/migrations-d1/0011_mcp_connections.sql), [0012](../source/migrations-d1/0012_policy_acknowledgements.sql) and [0013](../source/migrations-d1/0013_analytics_subject.sql) with those handlers.

[Own-data export](../source/server/privacy-data.ts) requires a live owner/tenant session and recent proof, independently of new Terms or optional purposes. Bounded pages → browser aggregation → JSON with scope/exclusions. It is not a media archive.

The [audit](../12-functional-integrity-audit.md) exercised local SQL/access/export/failures and synthetic deletion. Real authentication and external-erasure portions remain UNKNOWN; these arrows do not assert provider execution.
