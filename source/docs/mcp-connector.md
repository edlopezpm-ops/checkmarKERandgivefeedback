# marKER assistant connector

The connector implements fifteen finite MCP tools over marKER's existing editorial
and Studio backend. The native classifier, planner, analysis and domain files are
unchanged. Conversations can prepare editable campaigns; the same native UI and
no-agent workflow remain available. No model/API key or hosted subscription
inference is needed merely to serve these tools.

## Connect

1. Open Agents or Environment in hosted marKER and select **Open marKER in
   ChatGPT**. Install/open the registered app-backed plugin in the assistant.
2. Select Connect in the assistant. It starts the ordinary OAuth flow using
   `https://marker.aekr.io/api/mcp`. Public DCR and PKCE S256 are supported; users
   do not copy credentials or run a bridge.
3. Use the existing marKER login only if needed. A server-bound, short-lived
   correlation handle preserves the validated transaction through email, Google
   or GitHub login. The same-origin application recognizes an existing session
   and resumes consent automatically without weakening the Strict owner cookie.
   Inspect the client name, callback and permissions, then select Allow.
4. Ask the assistant to find your product, read its material, prepare a campaign
   and save a proposal. Review the same draft in marKER. Ask for a render when
   appropriate, inspect it, approve the exact revision in marKER, then export.
5. Disconnect a grant in Environment to revoke its access and refresh credentials.

The canonical private connection is the registered
[marKER app-backed plugin](https://chatgpt.com/plugins/plugin_asdk_app_6add5fc8a2f88191bc7b84402dc6d820),
version 1.0.1. It was created through ChatGPT's **Add custom MCP server** flow
using the hosted endpoint, OAuth discovery and DCR. Read is the base scope;
read/write/produce are the selected defaults and delete is unchecked. Its real
App binding and presentation were preserved when adding the existing campaign
skill. Creating or updating it does not complete the owner's OAuth consent.

[`integrations/chatgpt/marker`](../integrations/chatgpt/marker/) retains the
reproducible portable MCP package and canonical campaign skill source. That
earlier raw package is a developer artifact; importing it alone does not create
the registered ChatGPT App connection. To update the registered private plugin,
retrieve its current files and release ID through Plugin Creator, overlay the
skill with a guarded update, and preserve the App binding and presentation.
No credentials, private account bindings or runtime data belong in source or
the public review projection. The older raw private plugin is retained; the
product CTA points only to the registered App-backed connection.

The ordinary catalog has fourteen actions (read, write and produce), including
descriptors for permissions not yet granted so the host can request them when
needed. Backend execution still checks every permission first. Deletion is
listed only after a separate, explicit `marker:delete` grant. The normal registered
app requests read/write/produce, with delete unchecked. Missing permissions return
the standard HTTP or MCP `_meta["mcp/www_authenticate"]` challenge; they do not
create product effects or retry receipts.

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
D1 tables; `0011_mcp_connections.sql` adds explicit authorized-client lifetime and
an expiring pending-login table. Local development upgrades its separate
`mcp.sqlite` once without changing its identity. OAuth values are opaque;
only SHA-256 access/refresh/code/consent hashes are stored. Codes are single-use,
PKCE/resource/client bound. Rotating refresh reuse revokes the entire family.

Access lasts 15 minutes, a grant family 30 days, a code 2 minutes and consent 10
minutes. Never-authorized registered clients expire after 90 days; approved client
IDs remain stable across grant expiry, revocation and reconnection. Limits include 200 retained
clients, 20 registrations per observed IP/hour and 30 consent requests per owner
per ten minutes. CIMD is explicitly not advertised; public DCR is supported.
Pending login handles expire after ten minutes and are single-use. They have no
owner or account access until the authenticated owner explicitly approves consent.
Native callbacks use literal IPv4/IPv6 loopback HTTP and may change only their
port; scheme, host, path and query stay exact. Token exchange binds the concrete
authorization callback, including the selected port. Remote HTTPS remains exact.
Browser-origin MCP calls are restricted to marKER's own origin; server-to-server
hosts omit Origin. A future browser-origin host needs a separately reviewed rule.

Expired-grant cleanup cascades its credentials and request/effect history. Applied
product materials/variants remain in their ordinary domain custody. Connector
history is therefore not an indefinite audit archive. Account deletion first
freezes all connector writes, then purges all eight tables with the existing
account-wide deletion. No new identity can resurrect the deleted workspace.

## Delivery and verification

Source implementation and isolated SDK/SQLite/backend verification are separate
from production activation. Apply migrations `0010` and `0011` through the existing
deployment process. Both metadata routes must reach the Worker before static SPA
fallback. Real installation, OAuth consent and an actual dot conversation are
required after deployment before claiming the Gmail-like experience is live.

The pinned SDK currently negotiates MCP2025-11-25. Record the actual host-negotiated
version; do not claim conformance to a newer protocol solely because its public
specification exists. The [integration design](assistant-integration-design-2026-10-24.md)
documents supported-client tests and the later CIMD/SDK/public-submission work.
