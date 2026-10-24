# 09 — Review guide and open decisions

## Preserve before proposing

Preserve the single-owner access model, server-side revision/rights/admission checks, original media custody, separate editorial and Studio state, explicit review/approval/export, paused paid proposals, immutable job history and exact original logo/font identity. The planner's deterministic abstention is intentional when input is insufficient; do not replace it with fabricated copy or an implicit provider call.

A detached reviewer can assess architecture and contracts from this package. They must state that source bodies and live state are unavailable. A recommendation becomes implementable only after the maintainer maps it back to the pinned source and checks any later drift. Line references are navigation evidence, not a proof that a suggested patch compiles.

## Concrete review questions

| Area | Question tied to current behavior | Useful evidence for a change |
| --- | --- | --- |
| Creative workflow | Which required owner actions create friction between capture, classification, proposal, editing, render, review and export? | Exact current sequence, proposed delta and realistic owner pilot timings/correction count. |
| Frontend state | Are form recovery, stale inputs and independent revision conflicts legible across two tabs/devices? | Named component/state/error path and a conflict scenario preserving both drafts. |
| Product wording | Do Space/Campaigns, Drafting, analysis and AI labels accurately describe delivered behavior? | Exact screen/function and replacement text, EN/ES parity, no invented capability. |
| Data model | When does one editorial JSON document stop being sufficient, and which entity genuinely needs normalization next? | Measured volume/contention/query need and migration/rollback boundary. |
| Processor | Is per-operation native bootstrap sufficiently reliable within 240 seconds? | Actual cold-start timing/toolchain identity, failure phase and bounded alternative cost/maintenance. |
| Jobs | Can enqueue, lease expiry, object finalization or failed cleanup leave conservative reservations or uncertain state? | Named durable stages, safe reconcile operation and failure injection. |
| Planner | Are rights, literal copy, coverage, reuse and fingerprint checks sufficient for a realistic campaign? | Counterexample mapped to source checks and a minimal deterministic correction. |
| Storage | What is the explicit retention/purge/recovery contract before more owner media accumulates? | Dependencies, dedup/history preservation, object/DB reconciliation, undo/recovery and authorization. |
| AI | Which actual admission/entitlement and retention decisions must be evidenced before live generation? | Selected route, issued grant/model/accounting contract and explicit limits; no assumed eligibility. |
| Devices | Which iPhone/Safari and Android/Chrome interactions/codec interruptions remain unverified? | Physical device/browser versions, authorized media, observed errors and recovery. |
| Documentation | Where do older architecture/setup/backlog claims contradict implemented Studio/Settings? | Pinned source and precise prose correction; do not rebuild implemented work. |

## Known unresolved decisions and capabilities

Actual SIWC hosted admission/client/model/plan grant, provider-aware usage limits, uncertainty/retention/recovery remain open. Hosted technical analysis needs exact native toolchain verification before the disabled pin is changed. Phone/creative pilot, invoice comparison and restore rehearsal require actual operational evidence. The public dossier does not resolve those decisions.

Potential additions include transcription/subtitles, per-clip crop/brand/cover controls, capture/background/PWA workflow, licensed music/trends, CSV/live metrics, one selected social publication operation and eventually advertising/native automation. Their value and scope must be justified against current workflows. They are not all preconditions to using the current manual console.

## Required feedback record

For each substantive finding, supply: ID/priority; observed current behavior and exact dossier section/node; source anchor or catalog entry; whether it is a demonstrated contradiction, inference or unknown; concrete user impact; smallest coherent change; affected frontend/backend/schema/job boundaries; preserved invariants; alternatives/tradeoffs; focused success/failure/conflict checks; migration/recovery implications; exact unresolved owner decision. Avoid generic advice, invented endpoints, duplicate infrastructure and unsupported security/performance claims.

Order suggestions by practical value and dependencies. Separate correctness defects, workflow improvements, structural hardening and optional scope. If a fact cannot be resolved without source/runtime evidence, request that exact evidence rather than invent it. Do not provide a pretend ready-to-apply patch against unavailable code.
