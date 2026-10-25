# Optional Agents and external MCP

Local Agents: [panel](../source/src/console/Agents.tsx) → [server-derived context/run ledger](../source/server/agents.ts) → [loopback bridge](../source/tools/agent-bridge.mjs) → official app-server → validated proposal → explicit Studio material save → native planner. Original run/context/model provenance persists; final-output replay is separate from repeating inference.

External host: OAuth metadata → [public client registration, owner consent and PKCE](../source/server/mcp-auth.ts) → [opaque scoped token store](../source/server/mcp-auth-store.ts) → [SDK transport/idempotency](../source/server/mcp.ts) → [fifteen finite tools](../source/server/mcp-tools.ts) → existing editorial/Studio backend. Revocation/expiry/deletion must close tool and artifact access. MCP cannot approve; the owner uses the ordinary app before export.

Read [OAuth tests](../source/tests/mcp-auth.test.ts), [tool tests](../source/tests/mcp-tools.test.ts), [SDK integration tests](../source/tests/mcp-integration.test.ts) and [Profile deletion tests](../source/tests/profile.test.ts). An SDK client and synthetic fixture are not an actual installed Dot/ChatGPT conversation or proof of compatibility with every host.

Canonical host package: [metadata](../source/integrations/chatgpt/marker/plugin.json) + [MCP/OAuth configuration](../source/integrations/chatgpt/marker/mcp.json) + [campaign skill](../source/integrations/chatgpt/marker/skills/prepare-campaign/SKILL.md). Packaging and hosted server verification do not establish owner OAuth or an actual host conversation.
