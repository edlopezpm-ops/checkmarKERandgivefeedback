# marKER assistant connector

The connector exposes fifteen finite MCP tools over marKER's existing editorial
and Studio backend. The native classifier, planner, analysis and domain files are
unchanged. Conversations can prepare editable campaigns; the same native UI and
no-agent workflow remain available. No model/API key or hosted subscription
inference is needed merely to serve these tools.

## Connect

1. Start marKER locally with `npm run dev`, or use the separately deployed hosted
   release after its migration is applied. Environment → Connected assistants
   shows the exact connection URL: `https://marker.aekr.io/api/mcp` in production.
2. Add that URL as a custom MCP server in the assistant host. Select OAuth. The
   authorization server supports public dynamic client registration with `none`
   token authentication and PKCE S256; no client secret needs to be copied.
3. Sign in to marKER in its own tab when asked. Return to the connector consent
   page, inspect the client name, callback domain and requested permissions, and
   select Allow. This uses existing marKER email/Google/GitHub identity; it is
   separate from Sign in with ChatGPT and its hosted admission requirements.
4. Ask the assistant to find your product, read its material, prepare a campaign
   and save a proposal. Review the same draft in marKER. Ask for a render when
   appropriate, inspect it, approve the exact revision in marKER, then export.
5. Disconnect a grant in Environment to revoke its access and refresh credentials.

OpenAI's [custom MCP connection guide](https://developers.openai.com/api/docs/guides/custom-mcp-server)
describes installation. [Dot uses supported installed plugins](https://learn.chatgpt.com/docs/dots/computers-and-apps);
availability, workspace controls and voice support still require a real host test.
An SDK integration test is not proof of a dot conversation. Other MCP hosts must
be tested separately; the server does not claim every client or protocol version.

Local authorization is deliberately loopback-only. A remote assistant needs an
approved secure tunnel or the deployed HTTPS endpoint; a public internet caller
cannot use `127.0.0.1`. Local mode uses its own persisted local identity and never
copies hosted sessions, Codex account credentials or OAuth tokens between stores.

## Tools and permissions

| Permission | Tools |
| --- | --- |
| `marker:read` | `marker_get_profile`, `marker_search`, `marker_get_campaign`, `marker_get_material`, `marker_prepare_plan`, `marker_get_job` |
| `marker:write` | `marker_save_product`, `marker_save_campaign`, `marker_save_material`, `marker_classify_materials`, `marker_save_plan`, `marker_edit_variant` |
| `marker:produce` | `marker_render`, `marker_export` |
| `marker:delete` | `marker_delete` |

Every call resolves owner/tenant from its validated bearer. Tool arguments never
select a user or tenant. Private data needs authorization. Descriptions instruct
the assistant to ask about ambiguous records and never invent rights, review,
speech, product claims or consent. New text/idea materials default to unknown
rights and unreviewed; explicit user-declared facts can be supplied as in the UI.
Classification only fills missing deterministic type/name labels. Preparation
calls `prepareStudioPlan` and the existing server planner with original rights,
reading/range/history/consent checks. Save recomputes the native fingerprint.

Tools omit generic HTTP/SQL/command execution, account deletion, approval,
social publication and paid activation. Media originals are uploaded through the
existing UI. Render uses the existing processor/budget admission. Queued, running,
failed and completed are distinct; completion never means human approval.

## Revision and retry contract

Writes require `expected_revision` and a stable 8–100 character `request_id`.
Product operations use the workspace revision; Studio operations use its separate
revision. Editing/render/export also use the variant's `recipe_revision`. Read
fresh state first. A request ID is scoped to its grant and bound to exact tool and
arguments. An identical completed request returns its saved result. Reusing an ID
for different arguments fails. Concurrent or interrupted execution returns a
pending/uncertain result, never an automatic second effect. Inspect the current
product before deliberately issuing another request. Domain CAS remains intact.

This is an at-most-once admission guard, not a distributed transaction across
domain and receipt commits. A committed domain write with a lost receipt remains
uncertain for manual reconciliation. Per-grant receipt capacity is 5,000. The
connector's request record identifies client/grant/action; it does not invent the
external host's model identity or alter existing trusted agent-generation receipts.

TXT export returns the literal approved text. MP4 export returns a private URI
under `/api/mcp/artifacts/:variantId?recipe_revision=N`. Download requires the
delegated produce token or the owner's existing browser session, and rechecks
the exact recipe and native export rules. It streams the existing file without
copying large media into chat or making a public bearer URL. Expired/revoked
connections and changed or unapproved recipes cannot download through the grant.

## Authorization and storage

The official pinned MCP SDK handles stateless Streamable HTTP/JSON. The Worker
uses its non-code-generating `@cfworker/json-schema` provider. No in-memory session
map or hosted filesystem stores product authorization. `0010_mcp.sql` adds seven
D1 tables; local development uses separate `mcp.sqlite`. OAuth values are opaque;
only SHA-256 access/refresh/code/consent hashes are stored. Codes are single-use,
PKCE/resource/client bound. Rotating refresh reuse revokes the entire family.

Access lasts 15 minutes, a grant family 30 days, a code 2 minutes and consent 10
minutes. Registered clients expire after 90 days. Limits include 200 retained
clients, 20 registrations per observed IP/hour and 30 consent requests per owner
per ten minutes. CIMD is explicitly not advertised; public DCR is supported.
Browser-origin MCP calls are restricted to marKER's own origin; server-to-server
hosts omit Origin. A future browser-origin host needs a separately reviewed rule.

Expired-grant cleanup cascades its credentials and request/effect history. Applied
product materials/variants remain in their ordinary domain custody. Connector
history is therefore not an indefinite audit archive. Account deletion first
freezes all connector writes, then purges all seven tables with the existing
account-wide deletion. No new identity can resurrect the deleted workspace.

## Delivery and verification

Source implementation and isolated SDK/SQLite/backend verification are separate
from production activation. Apply `0010_mcp.sql` only through the approved existing
deployment process. Both metadata routes must reach the Worker before static SPA
fallback. Real installation, OAuth consent and an actual dot conversation are
required after deployment before claiming the Gmail-like experience is live.
