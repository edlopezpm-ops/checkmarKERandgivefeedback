# Agents in marKER

Agents complement marKER's native classification and rule-based campaign assembly. The Space → Campaigns → review → export workflow remains available when no agent is connected or the runtime is offline. Agent proposals enrich the same editable materials and recipes; they do not replace the internal planner or its validation rules. External conversational integration uses the separate additive connector below; social-account integration remains deferred.

The additive [MCP connector](mcp-connector.md) now exposes authenticated read/write
product tools for external assistants. It reuses the same native engine and
existing backend. Its OAuth grants are separate from the local Codex bridge and
from hosted Sign in with ChatGPT inference. Production activation and actual host
installation/conversation require their own verification; social APIs stay deferred.

The Agents panel works beside Space and Campaigns. Studio stays mounted while the panel is open or another Console section is selected. The visible context identifies the product, Studio campaign, selected material cards and variant; editorial campaigns remain a separate workflow.

The first adapter uses the official local Codex app-server with its managed ChatGPT sign-in. The agent role (copy, assembly or review), provider/model, runtime and product tools are separate records. A Node bridge runs independently of the Cloudflare Worker and FFmpeg processor. It polls for explicitly requested runs, reports real activity/text events and returns structured copy proposals. Provider credentials remain in Codex's own managed account store; they are never copied to the browser, Studio or D1.

Current official [app-server authentication guidance](https://learn.chatgpt.com/docs/app-server#authentication) permits this managed sign-in for local/open-source applications and excludes commercial or hosted services. Therefore the native bridge accepts only loopback marKER origins. The D1 adapter and migration prepare the ledger for the main deployment; hosted subscription inference requires a separately admitted [Sign in with ChatGPT integration](https://developers.openai.com/siwc/). A pairing token or paid ChatGPT subscription does not establish hosted-app admission. See [bridge setup](AGENT_BRIDGE.md) for the executable commands and actual account checks.

Connections, sessions, runs, events, drafts and effect receipts live in their own tables: local `agents.sqlite` or D1 migration `0006_agents.sql`. They never enter the aggregated editorial Workspace JSON. The server derives context from current product/Studio records, records material versions and rejects invalid cross-product references. The bridge receives bounded text/metadata selected for the request; it does not inspect originals or the product source repository. It cannot approve/export/publish content by generating text.

Apply an edited copy explicitly to save a Studio text material through `material.save`. Its immutable generation receipt identifies the connection, actual model, run, proposal and source versions. Subsequent edits retain that receipt; variant source snapshots and render job receipts carry it forward. Agent state and Studio recipe/library revisions are distinct. When source context changes, compare the saved proposal and refresh its context before applying a new plan.

Assembly uses the existing deterministic planner, including its rights checks, literal developed text, source ranges, server recomputation and revision/fingerprint validation. Applying an alternative creates or updates a real Studio variant. Production continues through the existing render job, actual result review, approval of the exact recipe revision and export. Export is not social publication.

The agent ledger keeps stable request/effect identities so reloading, repeating an HTTP request or reconciling a committed save does not create a second material/variant. Runs have explicit deadlines, one concurrent provider turn, a daily run limit and cancellable status. A bridge disappearance is visible as offline; interrupted inference is not silently retried. Cancellation requests an app-server interrupt and preserves committed product effects. It is not a provider billing guarantee.

Subscription usage is shown as ChatGPT/Codex plan usage. It is separate from Settings' dollar allocations for hosted processing or a future paid API. No API-key fallback is selected. Runtime limits restrict admission/time/concurrency; they do not cap a provider invoice or guarantee a token quota. Local history retention/size limits are distinct from the provider's account retention policy.

The history cleanup setting removes old activity and conversations without applied results when the overview is read. Saved proposals and their original run/context/session records remain for provenance and duplicate-effect recovery; they are not deleted after the configured number of days. Studio materials, variants and job receipts have their own custody. Initial agent limits are 200 sessions, 1,000 retained runs, 500 activity events per run and 30 selected context materials; reaching a retained-history ceiling requires maintenance rather than automatic deletion of applied evidence. These are bounded first-version limits, not a promise of unlimited history or complete provider-side erasure.

One local process must own each development data path. Keep `.local/`, pairing credentials, account stores and private evidence out of source control. Restarting marKER or closing the panel retains durable conversations, runs and proposals. Keep the bridge running while using the local agent; reconnecting reports availability from its real heartbeat.
