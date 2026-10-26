# 07 — Agents, MCP, Analytics and capability status

Current snapshot: 26 October 2026, `77bbedac`. The optional local Agents bridge, external MCP and hosted inference are separate routes. MCP lets an external assistant call finite product tools; marKER does not need to host model inference merely to serve them. A subscription, pairing token or MCP grant does not establish hosted SIWC admission.

| Route | Current implementation and audit evidence |
| --- | --- |
| Native no-agent preparation | Classification, literal library preparation, deterministic planning and ordinary production remain independent of optional providers. Actual native media and restart persistence passed in the audit. |
| Local Agents bridge | [agents.ts](source/server/agents.ts), [store](source/server/agents-store.ts) and [bridge](source/tools/agent-bridge.mjs) retain context/run/proposal/effect identities. Local loopback managed-ChatGPT route only; no new inference was invoked in this audit. C09 remains UNKNOWN for the real execution portion. |
| External MCP | [transport](source/server/mcp.ts), [OAuth](source/server/mcp-auth.ts), [tools](source/server/mcp-tools.ts) and [local adapter](source/server/mcp-local.ts) reuse native backends. Local DCR/PKCE/consent/token, 14-tool discovery, a durable product save, replay/conflict, revocation and new-instance persistence passed. |
| Central Analytics | [relay](source/server/analytics.ts) consults the fixed central collection API for owner-scoped configuration/preferences, explicit interests and audience counts. Current-purpose/GPC/privacy-field/failure logic was exercised locally; C11 remains UNKNOWN for authoritative ACK semantics and real central effects. |
| Hosted inference/social/paid routes | Hosted SIWC admission and effective plan grant unresolved; social APIs, automatic publication and paid activation remain deferred. Hosted analysis is disabled pending real toolchain verification. |

The normal hosted Agents/Environment view opens the registered private App-backed plugin and manages authorized connections through [McpConnections](source/src/console/McpConnections.tsx). Developer bridge controls appear only in explicit loopback DEV affordances. Conversations happen in the selected external assistant; first-party human review/approval remains in marKER.

MCP uses opaque scoped credentials, Authorization Code/PKCE S256, bounded owner consent and a single-use login-resume handle. Native literal-loopback callbacks may vary only their port; remote callbacks match exactly. Client/resource/user/tenant/scopes and current account lifecycle are validated server-side. Refresh reuse revokes its family, and disconnect closes access. Refer to the [connector contract](source/docs/mcp-connector.md) and [source tests](source/tests/mcp-auth.test.ts) for exact limits and errors.

| Scope | Finite tools |
| --- | --- |
| `marker:read` | `marker_get_profile`, `marker_search`, `marker_get_campaign`, `marker_get_material`, `marker_prepare_plan`, `marker_get_job` |
| `marker:write` | `marker_save_product`, `marker_save_campaign`, `marker_save_material`, `marker_classify_materials`, `marker_save_plan`, `marker_edit_variant` |
| `marker:produce` | `marker_render`, `marker_export` |
| `marker:delete` | `marker_delete`, only after its separate explicit grant |

The ordinary catalog describes 14 non-delete actions; listing an action does not grant execution. Writes require applicable revisions and a stable request ID bound to grant/tool/arguments. Identical completed requests replay the result; changed arguments conflict. Pending or uncertain effects require reconciliation rather than a new ID. At-most-once admission is not a distributed transaction between the domain write and the receipt.

Tools cannot approve the result, delete the account, publish socially or execute arbitrary shell/SQL/HTTP. TXT is literal approved text; MP4 uses a private revision-bound download checked against native export rules. Original media enters through the ordinary UI. The portable [plugin package](source/integrations/chatgpt/marker/) is reproducible developer source and does not recreate an account-specific registered App binding.

Versioned [policy declarations](source/server/policy.ts) are deliberate first-party actions. They do not grant optional Analytics purposes or let an assistant accept agreements. [Own-data export](source/server/privacy-data.ts) and [account deletion](source/server/profile.ts) retain separate rights/access rules. Analytics does not maintain a competing consent/commercial master or automatically capture Space, campaigns or provider-derived content. Its dated [publication receipt](source/docs/ANALYTICS_RELEASE_2026-10-25.md) records collection paused; no live status refresh or commercial event occurred in the audit.

Earlier hosted OAuth/catalog and two connected-read observations are retained under their dated [deployment receipt](DEPLOYMENT-STATUS.md) and product documents. They are historical evidence, not fresh results from this publication or a complete actual-host campaign. The local audit's real tool write does not substitute for that missing target-host flow. Dot/voice/physical-phone use, real refresh/reconnect/scope upgrades, private attachment behavior, CIMD/protocol migration and public submission remain separately bounded work.

F02 is **suspected SPEC_AMBIGUITY**, not confirmed FALSE_SUCCESS: the relay treats ACK HTTP 200 as confirmed despite a synthetic false/empty JSON body, but the authoritative ACK schema is unavailable. Obtain the contract and a real sandbox readback before deciding correctness. Source/fixture conventions alone cannot define it.
