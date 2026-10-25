# Rule-based assembly and optional technical analysis

This engine is the product foundation. Space organization and campaign preparation work without Agents or an AI subscription. Agents may improve copy or proposals through Studio's existing commands; they must not remove this route or bypass its source, review and export checks.

The hosted release includes this rule-based planner, extending the existing private sole-owner Studio. Exact deployment and owner readback are recorded separately. It does not configure an AI provider, publish content or change the existing login. Hosted analysis remains disabled until its actual binary is verified, independently of deploying the planner.

## Prepare an editable assembly

Select materials in Space and choose **Prepare campaign from selection**, or open a Campaign. The explicit Space action starts a new piece using that selection, including when an earlier variant or a recovered new-piece draft was open. Earlier variants and their drafts remain available. Opening an existing variant normally continues using that variant's own sources.

The planner opens immediately. For a new piece, **Prepare from my library** fills only empty fields: a compatible allowed pool when none was selected, one ready text used literally, the product name as hook and its saved call to action. With no ready text it may reuse the saved product description literally; multiple ready texts require choosing one. Entered copy, explicit source picks, duration and consent choices remain intact. An unsaved manual recipe must be saved or reviewed before this action. Preparation proposes the structure through the ordinary planner; it does not save, render or approve it.

You can still choose the visible product/shared pool of up to 50 materials, platform/template and developed hook/message/closing copy manually. Unfinished ideas are not expanded or rewritten.

Auto-selection uses compatible ready originals with owned rights. Licensed sources and any owned source with usage restrictions require explicit owner review for that piece. Sources whose rights status is unknown or restricted cannot enter a proposal. Shared backgrounds require opt-in; a personal video can accompany unrelated product copy. Audio-track presence never establishes speech presence. Confirm muted backgrounds explicitly, or preserve audio using human-confirmed ranges when speech is present/unknown.

The planner uses stable rules, not a creative quality score. Fixed ranges retain their order, then backgrounds fill the remaining duration in integer milliseconds. Each new background segment needs two seconds; the whole recipe stays within three visual segments and 5–60 seconds. Same-hash overlapping intervals already used in live recipes or completed history are excluded unless reuse is explicitly permitted. Available unused video intervals can be selected without repeating the beginning of an original. Recompressed copies are not recognized perceptually.

One main proposal and up to two alternatives show source ranges, reasons, exclusions and warnings. Changing inputs requires another proposal; this does not render video or reserve compute credit. Local draft recovery preserves input, while current-source CAS and fingerprint checks reject stale application. Saving a proposal creates an ordinary editable recipe with trusted planner/source/consent provenance. Manual edits preserve its provenance and invalidate approval when appropriate. Source or permission changes require explicit replanning. Legacy manual recipes keep their earlier workflow.

Reading checks initially require at least two seconds per nonempty visual text block and no more than 15 characters/second in the existing proportional template slots. This is a conservative aid; the real renderer still checks text overflow, and the owner reviews the actual MP4. No automatic rewriting, sentence cuts, captions, face tracking, per-clip crop or music synchronization is introduced. Global fit/focus/audio and the existing first-frame cover remain.

Save, explicitly render, review, approve that exact result and export. An existing successful render for the same variant/revision can be reused without another job. Explicit regeneration is a new admitted attempt. Export is separate from social publication.

## Native classification in Space

New material receives missing labels and roles from deterministic rules. Photos become photo/background, ideas remain idea/message, and literal text becomes ready-text/message. Video and audio names can provide explicit category hints such as B-roll, demo, talking, testimonial or voice. A generic video can receive a background-role hint without being certified as B-roll. These rules use file type and declared names; they do not recognize objects, understand speech, transcribe audio or judge creative quality.

**Classify selection** applies the same rules to one to 50 existing cards in a single revision-checked operation. Existing nonempty categories and roles remain unchanged. An unchanged reapplication preserves revision and dates. Manual corrections remain editable; saving an existing card does not immediately refill intentionally cleared labels.

Classification never assigns rights, changes review to ready, claims speech is absent, guesses a product or rewrites content. Review permissions and mark material ready before preparing a proposal. The existing B-roll, speech-range, shared-material and muted-background consent checks remain in force. Optional Agents can help improve the inputs, while every step above works with their runtime offline.

## Technical aids

Analysis is optional and requested explicitly for up to three originals/ranges, sequentially, with each range at most 120 seconds. Cached results carry original SHA, exact coverage, analyzer profile and actual tested FFmpeg version. Low-resolution thumbnails, scene-change candidates, low-volume intervals, dark intervals and low visual variation are navigation aids. They do not classify B-roll, recognize words, infer speech absence or decide that a dark/static shot is bad. Results may be partial or unavailable; the manual planner remains usable.

Choosing an analysis interval is a human range decision. The related immutable analysis ID is retained in proposal provenance and checked server-side for coverage, SHA, profile and toolchain. No source labels or speech fields are changed. Thumbnails are private authenticated derivatives, never public bucket objects.

Limits: six JPEG thumbnails totalling at most 1 MiB, 100 technical intervals and a 64 KiB result; admission reserves 72 KiB metadata and 1 MiB derivative space. Up to 1,000 analysis records share the 8 MiB live-metadata and 2 GiB original/result/reservation ceilings. History checks project at most 5,000 historical intervals, failing closed for planned operations before an unbounded query; current live selections remain bounded by existing entity/segment limits. Retain originals/history and stop admission at quota; no automatic purge or capacity upgrade.

The Node analyzer reuses the renderer's bounded fixed-argv process runner, local-file/protocol/format restrictions and FFprobe metadata. A 120-second analyzer deadline sits within the existing 240-second native operation deadline, including bootstrap/transfers. No caller may supply executable code, filter strings, media URLs or derivative paths. Native subprocesses and inherited-context review are not OS isolation claims.

## Local versus hosted delivery

Local analysis is verified against the explicit `ANALYSIS_LOCAL_TESTED_TOOL_VERSION` in the pure analysis contract. Another binary must be validated before updating that profile. The current profile's actual four filters, measurements and JPEG output were exercised with synthetic media; silence measurements did not alter human labels and original bytes were preserved.

`ANALYSIS_HOSTED_TOOL_VERSION` deliberately remains null. Hosted analysis refuses admission before compute/credit reservation until the actual native binary and filters have been verified in an authorized release. Local evidence is not proof of the managed Debian toolchain. The additive D1 migration `0004_studio_analysis.sql` was applied for this hosted release; schema availability does not enable analysis or certify its toolchain. No browser-controlled tool-version override exists.

Once enabled after verification, a new hosted analysis costs five internal admission cents per original/range/profile, at most 15 for three, shown before dispatch. Cache hits and recovery of the same saved operation do not duplicate the credit reservation. Failed compute is not refunded. Probe/render remain five/ten internal cents respectively. [Settings](settings.md) now holds the saved processing allowance, initially US$10 per UTC month, within the initial US$20 monthly planning budget. Its future AI allocation starts at US$0 and enables no provider. Neither the internal ledger nor planning budget is the Cloudflare invoice or its hard cap. Local analysis charges no cloud credit.

## Acceptance still required

Synthetic native/API/browser checks establish technical behavior, not creative quality or actual-device acceptance. Test iPhone/Safari and Android/Chrome with real authorized files, microphone denial, interruption/reselection, codecs/HDR/HEIC rejection, long text, duplicates, quota pressure and concurrent edits. No PWA, share target or durable background processing is promised.

Run the approved ten-piece pilot against the owner's manual baseline: target at least eight pieces needing no more than two structural corrections and a 50% reduction in median active human time. Those are pilot goals, not measured results. Measure startup/download/analysis/render/upload separately; repeated 240-second limits require an explicit runtime/image decision. Transcription, subtitles, semantic selection and generation remain separately authorized future capabilities.
