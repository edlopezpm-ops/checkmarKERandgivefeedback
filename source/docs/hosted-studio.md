# Private hosted Space and Campaign studio

The current hosted release adds the [rule-based planner and optional technical analysis](studio-planner.md) and [Settings](settings.md). Deployment, additive migrations and actual owner readback are recorded separately. The planner needs no AI; remote technical analysis remains disabled pending actual hosted toolchain verification.

Private hosted Studio was introduced on 2026-10-23 under the owner's release instruction. The React library/assembler has an owner-authenticated Worker adapter. Deployment, source publication and physical-phone acceptance are separate evidence; the release receipt records the actual deployed version.

## Use

Space accepts video, photos, audio, incomplete ideas and finished text. Product and quick classification are optional at capture and editable later. Speech is a human field independent of an audio track. A personal clip can be shared background for a product. Original files are retained; duplicate hashes share the original while intentional library entries remain separate.

In Campaigns choose a product, name and objective, then a platform, template, sources and manual copy. No social account is required. Save the recipe before rendering. Review its real MP4, explicitly approve the current revision and download it; text pieces export TXT. Changing a recipe invalidates approval. Five versioned templates provide overlay reels, narrated demonstrations, tips, motivation and text. They do not develop vague ideas, transcribe audio, synchronize subtitles or choose semantic content. Publication remains a separate manual step.

Original editorial sources, campaigns and the manual delivery queue remain available in their earlier-record sections. The separate development text simulator still makes no OpenAI requests and stays outside the production interface. A submitted Sign in with ChatGPT request is not a client ID or a grant to use a Pro plan.

## Hosting and limits

- Existing sole-owner email-code authentication wraps every Studio API and media response. R2 objects have no public bucket URL, public domain or browser credential. Originals/results stream through authenticated Worker endpoints, with bounded byte-range reads.
- Existing D1 holds separate assets, materials, campaigns, variants, uploads and immutable job receipts. Studio revision CAS and the editorial product-reference guard protect both commit orders. The earlier editorial workspace keeps its 1 MiB ceiling.
- One private-owner Durable Object coordinates a managed Debian/Node container through native exec and streams, using the existing FFmpeg renderer. There is no public processor port or general execution endpoint. Boot, package preparation, probe/render and result upload share a 240-second wall deadline; cleanup destroys the container.
- Admission: 250 MiB per original, chunks up to 8 MiB (nonfinal R2 parts at least 5 MiB), one upload/render at a time, 2 GiB storage including reservations, 1,000 entities per live collection, 8 MiB live metadata, 1.5 MiB per stored receipt/entity, 900 changed statements per mutation. Exceeding a limit rejects the operation rather than saving a partial change.
- Assembly: up to three visual sources, 5–60 seconds total, explicit ranges totaling that duration. Output is vertical 1080×1920 H.264 MP4, optional AAC and PNG cover. HDR and unsupported inputs remain conversion pending and their original stays downloadable. HEIC/phone codec compatibility is not universal.

The container uses the [native Container API](https://developers.cloudflare.com/containers/api/durable-object-container/) and a [Cloudflare-managed image](https://developers.cloudflare.com/containers/guides/image-management/). No Docker installation or new npm runtime framework is required. `npm run build` stages the exact renderer source with `tools/prepare-processor.mjs` before typechecking/building; its generated text file is ignored and regenerated in a fresh checkout.

## Spending and retention

The owner selected up to US$20/month for the remote design and both iPhone/Safari and Android/Chrome. This does not mean US$20 was spent, nor does it make ChatGPT Pro an API allowance. The design allocates approximately US$5 for a potentially required Workers Paid base, US$10 for processing and US$5 for storage, operations and headroom. Existing shared account allocations may change these estimates.

Server admission reserves 5 cents per new probe and 10 cents per new render against the owner-saved UTC-calendar-month processing allowance, initially US$10 in Settings. These are conservative internal credits, not a reproduction of Cloudflare's invoice. Failed compute is not refunded; duplicate enqueue/finalization reuses its job/reservation. Output storage reservations become actual stored bytes after completion. No provider billing hard cap is claimed: shared Workers/D1/R2/Container usage, platform failures and taxes remain outside this ledger. Review [Containers pricing](https://developers.cloudflare.com/containers/platform/pricing/) and [R2 pricing](https://developers.cloudflare.com/r2/pricing/) against the account bill. R2 activation has US$0 base with automatic renewal and usage overages under its accepted terms.

Originals, derivatives and immutable receipts remain until an explicit future retention/purge workflow. Removing an unused library entry does not purge its original. Used sources/history remain protected. The 2 GiB ceiling stops admission; there is no automatic deletion or storage upgrade. Metadata growth can stop a mutation before the file ceiling. Large fan-out rights edits can exceed the statement ceiling and require a smaller explicit maintenance operation; they never partially revoke rights.

## Interrupted work and mobile

Reselect the same file to resume at its committed offset; cancel an abandoned upload explicitly. Do not close the tab during an unfinished voice recording: its failure copy is held in memory with retry/download, not durable background storage. Recording requests microphone permission only when pressed and is limited to two minutes. Browser session storage can recover unsaved text/recipes; stale recovery requires confirmation before saving over a newer version.

Render jobs persist before enqueue. A lost enqueue can be resumed with **Resume waiting for saved render** without another credit reservation. An infrastructure failure gets one bounded watchdog, then parks until explicit resume. Interrupted running jobs become failures after their lease; they never silently start another paid render. Failed/interrupted work can retain conservative reservations until reconciliation finishes. Preserve D1, R2 and job IDs together; do not repair by overwriting the whole workspace or removing receipts.

Physical iPhone/Safari and Android/Chrome uploads, microphones, interruptions and codecs still require device verification. Responsive browser screenshots are not that acceptance. PWA installation/share target, background upload, batch capture, semantic selection, transcription/subtitles, configurable brand/logo/cover and purge controls remain separate work. No AI API, commercial music access, social posting or advertising activation is required by this flow.

## Operations

The additive Studio migrations leave the previous editorial schema intact. Before deployment record a D1 Time Travel bookmark and previous Worker version; rollback to that version does not require dropping Studio tables or deleting media. A recorded rollback reference is not a tested restoration. Never expose R2 public access to work around owner-session problems. Run the full affected tests/build and inspect the Worker/assets dry run before release. Actual deployment/version, authenticated render/export and Git SHA must be read back separately.
