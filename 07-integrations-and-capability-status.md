# 07 — Integrations and capability status

## Current capability matrix

| Capability | Pinned source status | What a reviewer must not infer |
| --- | --- | --- |
| Manual editorial records/review/export/outcomes | Implemented pure domain, API and React workflow. | Export is not publication; explicit outcome entry is not remote provider readback. |
| Sole-owner hosted login | Native browser-bound email codes and opaque D1 sessions selected by default Worker. | Public registration, another identity provider or multi-user admission. |
| Transactional access email | Email binding used for explicit sign-in/help flows with recipient/rate controls. | Marketing mail, arbitrary recipients, inbox receipt or a new login identity. |
| Private media Studio | Local and hosted adapters, private R2 streams, normalized D1 metadata, probe/render jobs. | Device/codec universality, restored backup or a newly executed render in this publication. |
| Rule-based campaign planner | Implemented deterministic proposals with ranges, exclusions and provenance. | Semantic generation, transcription, music synchronization or creative judgment. |
| Technical analysis | Local native analyzer implemented; hosted version pin is null and admission disabled. | Deploying its migration or allocating credits enables hosted analysis. |
| Settings | Saved revision-checked budget/storage/default duration; server-side admission. | Hard cap on provider invoice or activating a provider by assigning AI funds. |
| AI text simulator | Development-only in-memory mock followed by explicit draft save via editorial CAS. | A live OpenAI request, durable inference job or production simulator UI. |
| Sign in with ChatGPT | Maintained decision reports selected evaluation and interest-form acknowledgement. | Issued client, admitted hosted app, usable model/plan grant or configured OAuth. |
| OpenAI API / MCP | Alternative future connection designs; no active inference or tool endpoint implemented here. | Automatic fallback, API entitlement from subscription, or stable external SDK contract. |
| Social accounts | Shared destination metadata and platform-specific drafts. | OAuth connections, publication/programming, automatic remote status or live metrics. |
| Paid proposals | Domain retains paused preparation and explicit budget metadata. | Advertising activation, provider charge or authority to spend. |
| Supabase | Prepared owner auth and JSONB RPC adapter plus inactive migration. | Current default hosted persistence or applied PostgreSQL schema. |
| Phone/PWA/Android | Browser media/recording UI and responsive surface. | Native app, installed PWA/share target, durable background upload or Android device automation. |

Source map: `server/worker.ts:L16-L128`; [backend access](05-backend-api-and-access.md), [processing](06-studio-processing-and-jobs.md), [frontend](04-frontend-and-interaction.md), and [catalogs](10-source-map-tests-and-dependencies.md) locate the detailed implementations. The maintained intent/limits documents are `docs/ai-connection-decision.md`, `docs/text-simulation.md`, `docs/hosted-studio.md`, `docs/studio-planner.md` and `docs/settings.md` at the pinned snapshot.

## AI connection contract: planned, not delivered

The intended generation input must be bound to authenticated owner, source/product/campaign/destination IDs and workspace revision. Requests need identity/idempotency, explicit selected provider/model, limits appropriate to the actual granted route, validated editable outputs and conflict protection on save. Recovery must distinguish never dispatched, started, rejected, cancelled, completed and uncertain execution. A local timeout cannot establish no provider usage; uncertain work cannot safely be retried by assuming it never ran.

These are requirements recorded by the product's connection decision, not implemented live inference semantics. Actual hosted eligibility, client registration/callbacks, effective grant, model limits, provider-aware accounting, retention and recovery remain unresolved. The owner operates individually under the personal AEKR project name; no incorporated company or institutional eligibility is assumed. This dossier does not revalidate current provider policies or claim future acceptance.

The simulator's per-process registry is deliberately small and ephemeral. Reusing its request pattern as a production provider job ledger would omit durable uncertainty and cross-process recovery. Its validated source selection and explicit review/CAS save are useful existing boundaries to preserve.

## Future external effects

Any proposed social operation should be one selected network/operation with explicit credentials/scopes, durable idempotency, status reconciliation and cancellation/uncertainty behavior. Existing manual draft/export/outcome semantics should remain coherent. A network account record contains descriptive metadata, not authority to send.

If MCP is selected, model execution occurs in the host; a source-reading/draft-writing service would still need authenticated scope, bounded inputs and revision-safe writes. That would be a new supported external contract, not permission to expose existing private browser commands directly. If direct inference is selected, its admission and job ledger must model the actual provider accounting contract. Neither route follows automatically from this review.

CSV result intake, metrics/trend evidence, music licensing, captions/transcription, configurable brand/cover, purge/retention and native automation remain separate bounded proposals. Inspect implemented Studio and planner behavior before describing these broader gaps as a missing media pipeline.
