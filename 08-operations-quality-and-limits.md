# 08 — Operations, quality and limits

## This publication's verification scope

This is documentary work over unchanged tracked application source. Fresh prepublication checks cover catalog generation, applying five D1 migrations to an empty temporary SQLite database, source location validity, Markdown links, package data scope and hashes. The exact results belong in [PACKAGE-VERIFICATION.json](PACKAGE-VERIFICATION.json). Remote repository visibility and published-byte readback are separate postpublication checks outside that prepublication receipt.

Product tests, `npm run build`, cloud deployment, production migrations, authenticated login/media operations, physical phones, provider integration and recovery drills are **not executed by this publication**. Test inventories identify declared behavior checks; counting a test is not a passing execution result. Product documentation reports prior manual-console acceptance and hosted Studio delivery, while real device/creative pilot acceptance remains separate. Historical report statements are not converted into fresh certification.

## Local and hosted operations

| Boundary | Local engineering | Hosted source configuration |
| --- | --- | --- |
| Serving | Vite loopback, strict port and socket/Origin validation. | Worker custom-domain routing plus static asset binding and SPA fallback. |
| Authentication | Local session trusts the engineering environment; no email login. | Dedicated native email-code and opaque-session D1 flow. |
| Editorial persistence | Serialized JSON repository, atomic replacement; one process per path. | Atomic revision CAS in dedicated D1 workspace, 1 MiB ceiling. |
| Studio persistence | Local SQLite and files separate from editorial JSON. | D1 metadata plus private R2 originals/results and job records. |
| Media tools | Configured local FFmpeg/FFprobe/font paths. | Native managed-container exec/bootstrap/staging within deadline. |
| Analysis | Exact tested local profile. | Hosted profile pin null; refuses before credit admission. |
| Credits | No cloud compute credit reservation. | UTC-calendar-month internal reservations for admitted operations. |
| Simulation | DEV-only source review and mock text generation. | UI excluded; no live AI connection. |

Operational commands are descriptions, not actions taken here: `npm install` installs locked project dependencies; `npm run dev` starts local serving; `npm test` invokes Node's TypeScript-stripping test runner over `tests/*.test.ts`; `npm run build` prepares processor resources, typechecks, builds Vite and verifies original assets; `npm run types:worker` regenerates platform declarations. `npm run preview` previews built static UI and is not an authenticated production API emulator. Source: `package.json:L1-L26`, `vite.config.ts:L28-L142`, `tools/prepare-processor.mjs:L1-L8`.

## Installed engineering ceilings

| Resource | Initial/installed boundary | Meaning |
| --- | --- | --- |
| Editorial workspace | 1 MiB | Hosted JSON CAS document; Studio is separately stored. |
| Original file | 250 MiB | Admission rejects larger originals. |
| Upload chunks | At most 8 MiB; multipart nonfinal minimum 5 MiB | Resume committed offsets; not arbitrary whole-workspace writes. |
| Stored plus reserved media | Saved allowance at most 2 GiB | Admission includes pending results; no automatic purge/upgrade. |
| Live collection | 1,000 entities | Finite per-collection state. |
| Live metadata | 8 MiB | Independent ceiling; storage space alone does not guarantee admission. |
| Stored entity/receipt | 1.5 MiB | Oversized metadata rejected. |
| Changed SQL statements | 900 per mutation | High fan-out updates fail without partial rights revocation. |
| Studio assembly | Up to three visual segments; total 5–60 seconds | Explicit source ranges and literal copy, vertical 1080×1920 output. |
| Native operation | 240 seconds | Includes start, package/bootstrap, transfer, probe/render and upload; destroy in cleanup. |
| Optional analysis request | Three ranges sequentially, each at most 120 seconds | Technical navigation aid, not automatic content interpretation. |
| Analysis output | Six JPEGs, total at most 1 MiB; 100 intervals; 64 KiB result | Separate metadata/derivative reservations; exact coverage/provenance. |
| Historical planner projection | At most 5,000 intervals | Fail closed before unbounded projection. |
| Planning budget | Initially 2,000 integer cents/month; editable 0–2,000 | Internal planning number, not invoice hard cap. |
| Processing allocation | Initially 1,000 cents; processing plus future AI at most total | Atomic backend admission reads saved values. |
| Future AI allocation | Initially zero; connection remains false | Does not select model/provider or authorize inference. |
| Admission credits | Probe 5 cents; render 10; optional enabled analysis 5 | Conservative internal credits; failed compute is not refunded. |
| New-piece duration | Initially 20 seconds, editable 5–60 | Existing recipes keep their saved duration. |

These source/documented limits are explained in [chapters 02](02-data-model-and-transactions.md) and [06](06-studio-processing-and-jobs.md). Settings fields and integer validation: `src/core/settings.ts:L1-L39`. Values are implementation ceilings at the snapshot, not platform pricing advice, provider entitlement or measured monthly charges.

## Recovery and failure custody

Reselect the same original to resume an upload at committed offset. Cancel abandoned uploads explicitly. An unfinished microphone recording is held in browser memory with retry/download recovery; closing its tab can lose it. Text/recipe session recovery does not become a durable cross-device queue. Stale drafts must be compared before overwriting newer server data.

Saved jobs precede enqueue. Resume an existing waiting render using its saved job rather than invent a new paid attempt. The watchdog is bounded; interrupted running jobs expire through lease handling and do not silently start another render. Credit/storage reservations may remain conservative until reconciliation. Reconcile exact upload/job/object/revision identities before retrying effects.

For an authorized release, record the current Worker version, D1 recovery bookmark/schema and R2 custody, validate changed code/build/packaging, deploy the reviewed candidate, then read back actual version/assets/authenticated operation. Worker rollback does not roll back D1 writes, media, settings or job history. Prefer retained additive tables; any data restoration must account for intervening writes and R2/job consistency. A recorded bookmark is not a rehearsed restore.

No automatic purge/retention/offboarding control is implemented. Removing an unused library entry does not imply deleting its deduplicated original or immutable history. Device codec failures, HDR/HEIC limitations, long text layout, quota pressure, lost enqueue, object finalization failure and two-browser conflicts deserve targeted evidence in any relevant future patch.

## Quality and observation limits

Declared tests cover domain transitions, revision conflicts, SQLite-backed native authentication, hosted/storage contracts, upload/job failure handling, planner/analysis/renderer behavior, help/brand integrity, local Vite boundaries and animation/scheduler lifecycle. See [test inventory](10-source-map-tests-and-dependencies.md). Some media tests depend on actual local native executables/fonts. Synthetic mail and fixtures do not establish a delivered mailbox message or creative quality.

The processor starts a managed Debian image and installs unpinned Debian media packages during bootstrap, with internet enabled. Its bounded timeout is not a reproducible binary guarantee or provider billing cap. Hosted analysis correctly remains gated until its actual version/filters are validated; ordinary probe/render compatibility and reliability still need environment evidence for the candidate being released.

Source-traced controls are documented for review; this run is not an exhaustive vulnerability scan. Privacy/link/hash checks protect this publication's scope but do not certify every application path. The publishing authors/reviewer share the same host and model family; no independent OS isolation is claimed.
