# 07 — Agents, MCP and capability status

There are three distinct AI-related routes. The optional **local Agents bridge** can invoke official local Codex managed-ChatGPT inference. The **MCP connector** lets an external host call finite marKER product tools using delegated authorization; marKER need not host inference. **Hosted SIWC inference** is a separate admission/grant question and is not enabled by a Pro subscription, pairing token or MCP consent.

Local Agents are implemented in [agents.ts](source/server/agents.ts), [agents-store.ts](source/server/agents-store.ts), [Agents.tsx](source/src/console/Agents.tsx) and [agent-bridge.mjs](source/tools/agent-bridge.mjs). Server-derived context binds current product, campaign and up to 30 material versions. The bridge only accepts loopback marKER origins, communicates with its Codex child over stdio and polls marKER; it opens no inbound listener. Native provider credentials stay in Codex-managed storage. The bridge strips inherited provider/pairing credentials from child environment, disables inherited MCP servers and editing/external tools, and checks effective policy. Those controls are not a proof of OS containment.

Runs have explicit request identity, deadlines, one concurrent turn, lease/cancellation and final-output reconciliation. A lost completion response can replay a private receipt without invoking inference again. Offline/expired/failed runs remain visible and do not choose another billing route. Editable copy is explicitly saved through Studio with trusted provenance; assembly/render/approval/export reuse native rules. Local 30-day default cleanup removes old activity/unused conversations while preserving applied proposal/run/context evidence. Retained-history ceilings can require maintenance; no provider-side erasure guarantee follows.

## Authenticated external MCP

Read the complete [connector contract](source/docs/mcp-connector.md), [transport](source/server/mcp.ts), [authorization](source/server/mcp-auth.ts), [store](source/server/mcp-auth-store.ts), [tools](source/server/mcp-tools.ts), [local adapter](source/server/mcp-local.ts) and [migration](source/migrations-d1/0010_mcp.sql). The endpoint is `/api/mcp`; OAuth metadata paths must run before SPA fallback. The official SDK serves stateless Streamable HTTP/JSON with the Workers-compatible schema validator.

Public clients use dynamic registration (`none` token authentication), Authorization Code and PKCE S256. Existing marKER owner login precedes an explicit consent page naming client/callback/scopes. Tokens are opaque; stored access/refresh/code/consent values are hashes. Proofs bind resource, client, redirect, tenant and user. Refresh rotation reuse revokes its family; Environment can revoke a grant. A client cannot select a tenant.

| Scope | Finite tools |
| --- | --- |
| `marker:read` | `marker_get_profile`, `marker_search`, `marker_get_campaign`, `marker_get_material`, `marker_prepare_plan`, `marker_get_job` |
| `marker:write` | `marker_save_product`, `marker_save_campaign`, `marker_save_material`, `marker_classify_materials`, `marker_save_plan`, `marker_edit_variant` |
| `marker:produce` | `marker_render`, `marker_export` |
| `marker:delete` | `marker_delete` |

New text/ideas default to unknown rights and unreviewed unless the user explicitly supplies facts. Tools cannot approve, publish socially, delete the account, execute SQL/shell/HTTP generically or upload arbitrary originals. They call the same native preparation/domain/Studio routes; human approval remains in marKER.

Writes require expected revisions and stable request IDs bound to grant/tool/arguments. Identical completed requests replay results. Pending/uncertain execution is not automatically retried. This is at-most-once admission, **not a cross-store transaction** between domain mutation and effect receipt; a committed write with lost receipt requires reconciliation. Per-grant effect capacity is 5,000.

TXT export returns approved literal text. MP4 export returns a private revision-bound URI, with scoped token or existing owner-session download and a fresh check of native approval/export rules. No public bearer URL is created. Access tokens last 15 minutes; grant families 30 days; codes 2 minutes; consent 10 minutes; clients 90 days. Limits include 200 clients, 20 registrations per observed IP/hour and 30 owner consent requests per ten minutes. CIMD is not advertised. Browser-origin calls are restricted to the canonical marKER origin; server-to-server hosts omit Origin. Remote hosts cannot reach a local loopback endpoint.

Expired grants cascade credentials and request receipts; applied product entities retain normal domain custody. Account deletion freezes and purges all seven connector tables. This is not indefinite connector audit retention.

## Capability ledger

| Capability | Snapshot status |
| --- | --- |
| Native manual/editorial/Studio/planner | Implemented; prior hosted delivery and current local native checks have separate evidence. |
| Deterministic missing-label classification/library preparation | Implemented and verified locally; no semantic inference. |
| Local managed-ChatGPT Agents bridge | Implemented; one prior actual fictional-copy request reported in product docs; no new provider call in this refresh. |
| Authenticated MCP source/local SDK/native-media path | Implemented and root-verified locally; actual Dot/other-host installation/conversation remains unestablished. |
| Hosted MCP migration/deployment | Migration 0010 and all seven tables verified; Worker `99baf771-ac51-40d9-a76f-7652aaeb4e51` at 100%, with hosted metadata/denial and asset readback. See [deployment evidence](DEPLOYMENT-STATUS.md). |
| Hosted SIWC inference | Admission/client/effective plan grant unresolved. |
| Hosted technical analysis | Disabled until native toolchain verification. |
| Connected social APIs, advertising activation, live metrics, Android automation | Deferred/unimplemented. |
| Transcription/subtitles/semantic media selection/PWA background capture | Separate future capabilities. |

A private user-level plugin package was created and its manifest read back. Its default requested permissions are read, write and produce; delete is not a default permission. Package creation does not install it in the host or complete owner OAuth. The actual host page encountered CAPTCHA and needs the owner's action; no successful Dot connection or conversation is asserted. Private account identifiers and the private installation URL are intentionally outside this public dossier.

The reproducible package lives in [plugin.json](source/integrations/chatgpt/marker/plugin.json), [mcp.json](source/integrations/chatgpt/marker/mcp.json) and [prepare-campaign/SKILL.md](source/integrations/chatgpt/marker/skills/prepare-campaign/SKILL.md). It contains no account-specific installation ID or credential. The skill requires current revisions, stable request IDs, explicit facts/rights and first-party approval. The coordinator verified three-file ZIP parity and the intended manifest contract. OpenAI authentication extensions can diverge from the generic portable base-schema validation; this is not an all-host compatibility claim. The package commit changes no application runtime.
