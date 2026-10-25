# Request, authentication and persistence

Hosted: [entry](../source/server/entry.ts) → [worker](../source/server/worker.ts) → native auth/tenant/lifecycle → family dispatcher → domain validation → revision-checked D1 commit → bounded response. Public static/demo and OAuth metadata dispatch are explicit exceptions, not bypasses for private resources.

Local: [vite.config.ts](../source/vite.config.ts) loopback guard → local session/API adapters → [local repository](../source/server/local.ts) or [Studio SQLite](../source/server/studio-local.ts). Local development trusts its OS account and uses separate data.

Auth: email challenge → same-browser proof → opaque session → retained operator; Google/GitHub first link additionally requires recent native email proof. Profile deletion establishes durable freeze before stopping compute and purging app stores. Read [profile.ts](../source/server/profile.ts) together with [0009](../source/migrations-d1/0009_profile_account.sql) and [0010](../source/migrations-d1/0010_mcp.sql) to assess already-admitted writes.
