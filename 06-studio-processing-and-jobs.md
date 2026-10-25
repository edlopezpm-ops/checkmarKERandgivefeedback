# 06 — Studio processing, planning and jobs

Original capture is resumable: reserve upload/storage → append bounded chunks at the expected offset → complete/probe/hash → deduplicate original bytes → create library metadata. Reselection of the same file can resume from the committed offset. Unsupported media remains conversion-pending with the original retained; file-type assumptions are checked by native probing. Private R2 bytes stream through authenticated endpoints, including ranges; no public bucket URL is needed.

The native classifier fills only missing labels. The planner consumes eligible ready/owned sources, literal copy, ranges and explicit shared/reuse/mute choices. Licensed or restricted usage requires the applicable explicit review; unknown/restricted rights cannot be silently promoted. Audio presence is separate from human-confirmed speech. Rules exclude overlapping same-hash used ranges unless reuse is explicitly permitted; no perceptual deduplication is claimed.

Proposals comprise one main structure and up to two alternatives. Current planner fingerprints and source facts are recomputed server-side on save. Fixed ranges preserve order, backgrounds fill remaining integer milliseconds, and recipe/readability/overflow checks stay enforced. Changing source facts or recipe invalidates stale planning/approval. Native text stays literal; classification/preparation never substitutes an AI output.

| Installed bound | Meaning |
| --- | --- |
| Original ≤250 MiB; chunk ≤8 MiB | Hosted nonfinal multipart chunks also meet the R2 minimum; original retained. |
| One active upload/render; 2 GiB default maximum | Admission includes actual bytes and reservations; no automatic upgrade or purge. |
| 1,000 entities per live collection; 8 MiB live metadata | Bounded metadata growth independent of stored file size. |
| 1.5 MiB stored entity/receipt; 900 changed statements | Large fan-out edits fail without a partial rights mutation. |
| 3 visual segments; 5–60 seconds | Vertical 1080×1920 H.264, optional AAC, PNG first-frame cover. |
| 240-second native operation deadline | Includes bootstrap/transfers/processing; not a guarantee every phone file succeeds. |

Rendering persists a durable job before enqueue, reserves internal credits/storage and uses the existing bounded fixed-argv FFmpeg runner. Exact successful renders can be reused. Explicit regeneration is a newly admitted attempt. Enqueue loss can resume the saved job without another reservation; uncertain running work does not silently start another paid attempt. Infrastructure watchdog behavior is bounded and can park work for explicit resume. Failed compute is not refunded; conservative reservations can remain pending reconciliation.

Technical analysis is optional and limited to three originals/ranges, each ≤120 seconds. It produces low-resolution thumbnails and scene/silence/darkness/variation hints, not transcription, semantic classification or speech absence. Provenance pins original hash, coverage, profile and tested toolchain. **Hosted analysis remains disabled** while `ANALYSIS_HOSTED_TOOL_VERSION` is null. Local synthetic FFmpeg evidence cannot validate the managed hosted binary.

Review [studio-render.ts](source/server/studio-render.ts), [studio-analysis.ts](source/server/studio-analysis.ts), [processor coordinator](source/server/studio-processor.ts), [runner](source/processor/runner.mjs), [hosted adapter](source/server/studio-hosted.ts) and [planner contract](source/src/core/studio-planner.ts). Job completion, owner approval and manual export are separate transitions. Original/history custody must survive recovery.
