# Optional Agents and external MCP

Hosted [Agents](../source/src/console/Agents.tsx) and Environment → [shared connection view](../source/src/console/McpConnections.tsx) → registered private App-backed plugin → host starts OAuth → [registration/PKCE validation](../source/server/mcp-auth.ts) → bounded pending-login transaction if needed → [browser capture/session resume](../source/src/console/mcp-resume.ts) → authenticated consent → opaque scoped grant/token.

Authorized external host → [SDK transport](../source/server/mcp.ts) → fourteen normal descriptors (plus delete only with its explicit grant) → permission challenge or [finite native tool](../source/server/mcp-tools.ts) → existing editorial/Studio backend. Permission failures occur before effects/request receipts. Stable request identity and domain CAS remain independent safeguards. Human review/approval stays in marKER before private revision-bound export.

[Migration 0011](../source/migrations-d1/0011_mcp_connections.sql) preserves approved client identity and adds single-use pending-login state. The [local adapter](../source/server/mcp-local.ts) upgrades its own database transactionally without copying hosted identity or credentials. Revocation, expiry and account deletion close delegated access; the latter purges all eight MCP tables.

Local developer path only: explicit loopback development panel → [context/run ledger](../source/server/agents.ts) → [bridge](../source/tools/agent-bridge.mjs) → official app-server → validated proposal → explicit Studio save → native planner. Ordinary hosted UI does not poll this path or require bridge commands.

Read [OAuth tests](../source/tests/mcp-auth.test.ts), [resume tests](../source/tests/mcp-resume.test.ts), [local migration tests](../source/tests/mcp-local-migration.test.ts), [tool tests](../source/tests/mcp-tools.test.ts), [SDK tests](../source/tests/mcp-integration.test.ts) and [Profile deletion tests](../source/tests/profile.test.ts). A synthetic fixture or mobile viewport is not real host OAuth, a Dot conversation or physical-phone validation.

The [portable metadata](../source/integrations/chatgpt/marker/plugin.json), [MCP configuration](../source/integrations/chatgpt/marker/mcp.json) and [campaign skill](../source/integrations/chatgpt/marker/skills/prepare-campaign/SKILL.md) remain developer source. They do not recreate the registered private App binding by themselves. [The connector document](../source/docs/mcp-connector.md) describes that distinction and the authorized public installation CTA.
