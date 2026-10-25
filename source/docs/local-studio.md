# Space and Campaign: first local increment

Historical local-increment record. The subsequent owner-authorized release adds the [hosted Studio adapter](hosted-studio.md) and includes Studio in the production frontend. The local-only and unprovisioned descriptions below apply to the earlier increment, not that later release. Local engineering setup remains valid.

2026-10-23. The owner approved the Space-library/Campaign-assembler proposal and authorized this increment. This document describes the implemented local boundary; it is not a hosted release or physical-phone acceptance.

Run `npm run dev -- --port 5185`, open `http://127.0.0.1:5185/`, and use Space and Campaigns. Products still come from the existing workspace. Social accounts are not required to assemble a piece. The hosted console retains its existing manual workflow; Studio is development/local only and is excluded from the production frontend bundle.

## Current workflow

1. In Space, upload a video, image or audio file; optionally choose a product and quick classification. Alternatively write an incomplete idea/ready text or record a voice note in a supporting browser. Capture requires no full classification form.
2. Edit multiple categories, topics, functions, products, review state, useful range, description, speech, rights and restrictions later. No products means shared/unassigned. A personal clip can be a background for any product. Review readiness and usage history are separate.
3. In Campaigns, select a product and enter a name/objective. Create a piece for one of the existing platforms, select compatible/shared materials, choose one of five templates, and write the hook, developed message and closing or select saved text. Ideas are never developed automatically.
4. Choose source ranges, duration, framing/focus and sound. Save the editable recipe, generate a real MP4 preview, review it, explicitly approve that revision and export. Text posts can preview, approve and export TXT without a video processor or social account.
5. Changing the recipe removes approval. Source snapshots preserve versions and imported legacy text provenance. Current rights are checked again at approval/export; a different original cannot lend its rights to an older restricted source. Reusing material is visible and allowed intentionally.

The renderer uses fixed version-1 presets for overlay reels, narrated demonstrations, tips, motivation and text. Their timing, text panels and font sizes differ. No text is invented. A narrated demo requires confirmed speech in a selected video or sufficiently long uploaded narration. Narration replaces original sound. Keeping sound and confirming speech are separate choices. Text overlays are not automatically transcribed subtitles. Product identity can be written into the manual copy; configurable brand/logo assets and custom covers are still pending.

## Storage, limits and recovery

The existing editorial JSON remains unchanged. Studio uses local SQLite entity tables, upload/job tables and server-assigned file paths outside that JSON. Default directory: `.local/studio`. Originals are immutable and deduplicated by SHA-256; a duplicate upload can create a separate intentional library entry referencing the same original. Deleting an unused entry retains the original, which can be recovered from Space. There is currently no purge UI. Referenced entries are protected. Original bytes and renders stay on this computer until explicitly removed through a future retention workflow.

Limits: 250 MiB per file, one active upload and one render, 8 MiB maximum upload chunk, 1,000 entities per collection, 8 MiB aggregate metadata, three visual sources, 5–60-second exports, maximum 120 seconds per selected segment. Visual ranges must add up to the chosen duration. No silent trimming or frozen tail. Photo duration is its selected range. Output is vertical 1080×1920 H.264 MP4 with optional AAC audio and a PNG cover. Inputs with HDR transfer characteristics remain conversion pending; unsupported originals remain downloadable. No universal iPhone/HEIC/codec compatibility is claimed.

Uploads retain committed offsets on restart. Reselect the same file to resume; cancel an abandoned session before choosing another. Recorded audio is bounded to two minutes and retains an in-memory retry/download copy after a failed save; keep the tab open until saved or downloaded. It is not crash-durable background capture. Microphone access is requested only on pressing Record. In-progress recording/pending audio blocks module navigation and warns before closing. Browser support and permission must be checked on the actual device.

Unsaved text/recipes are retained in session storage for the current tab when available. A recovered older edit requires explicit confirmation before overwriting the newer saved recipe. Rendering, approval and export are unavailable while visible recipe edits are unsaved. Session storage is a convenience, not a backup or offline synchronization guarantee. Interrupted local render jobs become visible failures after server restart; successful obsolete previews never replace a newer recipe.

## Local multimedia tools

Node 24 supports the native SQLite adapter; no runtime npm dependency was added. FFmpeg and FFprobe must be available at explicit absolute paths through `MARKER_FFMPEG` and `MARKER_FFPROBE`, or under `.local/tools/ffmpeg/bin/ffmpeg.exe` and `ffprobe.exe`. `MARKER_FONT` can select a local TTF. The development default uses the existing Montserrat TTF if present; the processor otherwise uses a system font. `MARKER_STUDIO_DIR` and `MARKER_LOCAL_DATA` can isolate engineering fixtures.

This run downloaded a checksum-verified Windows essentials build from [Gyan's FFmpeg builds](https://www.gyan.dev/ffmpeg/builds/) into ignored local tooling. The executables are not committed or bundled with marKER. Renderer process arguments are fixed, shell execution is disabled, network protocols/playlists are restricted, and time/output limits apply. These limits do not provide an operating-system sandbox. Use this adapter only on loopback, one process per studio directory.

## Remaining decisions and hosted work

The prepared `migrations-d1/0002_studio.sql` was tested only in isolated SQLite and has not been applied to hosted D1. Hosted delivery still requires an owner-authenticated media API, private object storage, signed/resumable upload handling and a separately provisioned render worker/container with an explicit spending ceiling. The current Worker cannot execute this Node/FFmpeg adapter. Cloud deployment, physical-phone upload/recording, PWA installation/share target, background resume, thumbnails before original download, technical scene/silence assistance, subtitle synchronization and retention/purge policy remain separate work.

| Component | Local increment | Optional hosted cost basis |
| --- | --- | --- |
| React/manual classification/text export | Existing app, no new paid API | Existing hosting plan |
| SQLite/entity metadata | Local disk | D1 usage under the selected account plan |
| Originals/renders | Local disk | R2 Standard: $0.015/GB-month after account-wide free allowance; operation charges also apply |
| FFmpeg render | This computer's CPU/time/disk | Workers Paid/Containers provisioning and metered compute, storage and possible logging/network costs |
| AI/transcription/semantic selection | Off; no request sent | Requires a separate selected technology, processing location, consent and explicit model/use/budget/retention limits |

These are component estimates, not an account bill or spending cap. Current account allocations have not been inspected. See [R2 pricing](https://developers.cloudflare.com/r2/pricing/) and [Containers pricing](https://developers.cloudflare.com/containers/platform/pricing/) before provisioning. The subsequent owner decision is recorded below. No services, paid AI, publication, advertisements, DNS or hosted data were activated by this increment. Submitted Sign in with ChatGPT interest is not a client ID, authorization grant or usable plan/API entitlement.

Owner decision received after the local build: design for **up to US$20/month of remote processing**, supporting **both iPhone/Safari and Android/Chrome**. Provisioning is still a separate explicit step. The initial remote design reserves $5 for a potentially required Workers Paid base, $10 for render compute, $2 for storage/operations/network/logging and $3 headroom. Shared account allowances and actual media benchmarks must be checked before treating those allocations as feasible. A provider invoice cannot be capped by a UI estimate: server-side admission/reservations and a stop before exhaustion must be implemented and verified before enabling work. The current local renderer is not that spending control. Physical-device fixtures must include Safari MP4/MOV/audio and Chromium WebM/Opus as well as interrupted uploads. No automatic expenditure follows from this design selection.

Completed renders and text approvals retain immutable recipe/source receipts. Changing a piece's current materials preserves prior-use evidence; historic source IDs/versions appear in the usage badge and protect deletion. Older engineering jobs created before receipt support explicitly show unknown provenance instead of an invented reconstruction.

## timeKER recipe example

Upload a personal cooking clip as shared B-roll, describe the useful 0–10-second range, independently mark speech absent if appropriate, and confirm rights. In a timeKER campaign choose an organization/clients objective and an overlay reel for Instagram. Write: hook “Cada cliente merece un lugar”; message “Antes de empezar, reúne el pendiente y el siguiente paso de cada cliente”; closing “Revisa cómo quieres organizar tu semana con timeKER.” This is illustrative manual copy, not a verified feature claim. Select the cooking clip as background, choose contain or deliberate crop, mute or keep its actual sound, save, render, review and approve before exporting. A real cooking clip and actual timeKER facts must be supplied/reviewed by the owner; the engineering examples use synthetic media and explicitly fictional products.
