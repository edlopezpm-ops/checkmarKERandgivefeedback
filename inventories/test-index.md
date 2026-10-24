# Static test declaration index

144 syntactic declarations in 19 tracked files. Includes `t.test` subtests, so this count is not a top-level test count, an assertion count or a result from execution. Names describe intended checks; their presence alone does not prove behavior.

| File | Declarations |
| --- | --- |
| `tests/access-help.test.ts` | 7 |
| `tests/assets.test.ts` | 6 |
| `tests/d1-hosted.test.ts` | 3 |
| `tests/editorial.test.ts` | 8 |
| `tests/generation.test.ts` | 6 |
| `tests/hosted.test.ts` | 2 |
| `tests/motion.test.ts` | 5 |
| `tests/native-auth.test.ts` | 11 |
| `tests/scheduler.test.ts` | 5 |
| `tests/studio-analysis.test.ts` | 7 |
| `tests/studio-api.test.ts` | 8 |
| `tests/studio-hosted.test.ts` | 20 |
| `tests/studio-planner.test.ts` | 18 |
| `tests/studio-processor.test.ts` | 9 |
| `tests/studio-render.test.ts` | 5 |
| `tests/studio-vite.test.ts` | 4 |
| `tests/studio-watch.test.ts` | 1 |
| `tests/studio.test.ts` | 15 |
| `tests/ui-help.test.ts` | 4 |

## Every declaration

| Location | Kind | Declared name |
| --- | --- | --- |
| `tests/access-help.test.ts:L55-L70` | `test` | help sends the English guide only to the configured owner and returns generic responses without cookies |
| `tests/access-help.test.ts:L72-L86` | `test` | help sends Spanish instructions without changing existing challenges, sessions or login limits |
| `tests/access-help.test.ts:L88-L104` | `test` | help enforces origin, method, schema, JSON and bounded body before mail or counter writes |
| `tests/access-help.test.ts:L106-L115` | `test` | help cooldown and concurrent requests admit one mail, and IP admission is bounded |
| `tests/access-help.test.ts:L117-L122` | `test` | help global hourly admission limits rotating IP addresses without sending to unknown identities |
| `tests/access-help.test.ts:L124-L135` | `test` | help owner hourly and daily limits bound actual mail independently of IP and code requests |
| `tests/access-help.test.ts:L137-L146` | `test` | help provider failure is visible without leaking details or mutating auth state; SQL failure rolls back quotas |
| `tests/assets.test.ts:L14-L17` | `test` | default/rejected consent loads once in memory with no persistent writes |
| `tests/assets.test.ts:L18-L22` | `test` | acceptance caches resource, cleans old versions and revocation preserves other caches |
| `tests/assets.test.ts:L23-L27` | `test` | unavailable storage and quota failure fall back to host |
| `tests/assets.test.ts:L28-L32` | `test` | revocation during network load never leaves an optional copy |
| `tests/assets.test.ts:L33-L36` | `test` | oversized declared and streaming bodies are rejected |
| `tests/assets.test.ts:L37-L40` | `test` | network failure clears failed memoization for recovery |
| `tests/d1-hosted.test.ts:L29-L36` | `test` | actual SQLite schema and hosted repository keep CAS conflict and payload limit without lost records |
| `tests/d1-hosted.test.ts:L38-L55` | `test` | hosted product deletion cannot orphan Studio material or campaign in either committed order |
| `tests/d1-hosted.test.ts:L56-L81` | `test` | native auth plus data API completes owner login/write/logout and denies non-owner requests using actual SQL |
| `tests/editorial.test.ts:L63-L113` | `test` | manual editorial cycle preserves original whitespace, source references and explicit result evidence |
| `tests/editorial.test.ts:L114-L155` | `test` | shared account prevents equal absolute schedules across products and sources outlive one campaign |
| `tests/editorial.test.ts:L156-L192` | `test` | relationships reject foreign sources, incompatible accounts and destructive dependency changes |
| `tests/editorial.test.ts:L193-L214` | `test` | paid plans always start paused, require explicit budget/currency and cannot activate spending |
| `tests/editorial.test.ts:L215-L250` | `test` | readiness cannot be forged for empty/unreviewed or multimedia-only destinations |
| `tests/editorial.test.ts:L251-L284` | `test` | invalid input never mutates the prior state or invents records |
| `tests/editorial.test.ts:L285-L313` | `test` | bounded API rejects non-JSON, oversized streaming payloads and cross-origin writes |
| `tests/editorial.test.ts:L314-L352` | `test` | concurrent local writes reject stale revisions, persist across instances and never overwrite corrupt state |
| `tests/generation.test.ts:L33-L58` | `test` | all three fictional examples generate editable simulated drafts with exact source IDs and paused paid state |
| `tests/generation.test.ts:L60-L72` | `test` | concurrent duplicates share one result; changed input or snapshot cannot reuse the request ID |
| `tests/generation.test.ts:L74-L88` | `test` | missing, cross-product and non-campaign sources, incompatible destination and stale revision are rejected |
| `tests/generation.test.ts:L90-L101` | `test` | simulated errors, timeout, cancellation and malformed results never change the workspace |
| `tests/generation.test.ts:L103-L117` | `test` | saving after external edits and generation-time mutations is rejected; original schedule is preserved |
| `tests/generation.test.ts:L119-L139` | `test` | bounded session expiry, capacity, output size and clear reject retained or pending work |
| `tests/hosted.test.ts:L10-L64` | `test` | unconfigured hosted backend fails closed, anonymous and other identities cannot read or write |
| `tests/hosted.test.ts:L65-L109` | `test` | configured owner reads through Supabase and successful login returns HttpOnly cookie without browser tokens |
| `tests/motion.test.ts:L10-L23` | `test` | kung fu travels across the stage, jumps and exchanges sides in every variant |
| `tests/motion.test.ts:L25-L36` | `test` | genuine side and rear torsos have their own silhouettes and surface pixels |
| `tests/motion.test.ts:L38-L55` | `test` | all scenes retain finite bounded motion and a clean return to the same idle pose |
| `tests/motion.test.ts:L57-L66` | `test` | episodes vary in two dimensions while cooperative and winning reactions remain coherent |
| `tests/motion.test.ts:L68-L101` | `test` | cueca partners circle in depth, escobillan, alternate zapateo and salute without a winner |
| `tests/native-auth.test.ts:L68-L89` | `test` | native SQLite keeps owner auth separate, sends only allowlisted aliases and stores no raw identities, PINs or cookies |
| `tests/native-auth.test.ts:L91-L109` | `test` | PIN requires its browser cookie, allows the fifth attempt, consumes once and logout revokes the opaque server session |
| `tests/native-auth.test.ts:L111-L126` | `test` | locked, expired, cross-browser and duplicate-cookie challenges never create a session |
| `tests/native-auth.test.ts:L128-L136` | `test` | two concurrent correct verifications consume one challenge and create exactly one session |
| `tests/native-auth.test.ts:L138-L146` | `test` | an immediate resend preserves the existing browser challenge and the original PIN remains usable |
| `tests/native-auth.test.ts:L148-L162` | `test` | creation and verification failures roll back challenge, budget and session writes atomically |
| `tests/native-auth.test.ts:L164-L179` | `test` | session checks enforce canonical origin, allowlist, duplicated cookies, thirty-minute idle and six-hour absolute expiry |
| `tests/native-auth.test.ts:L181-L190` | `test` | the global hourly request quota is atomic and bounds attacker-created limiter rows |
| `tests/native-auth.test.ts:L192-L208` | `test` | mail failure has the generic response, invalidates the challenge and does not block HTTP on provider latency |
| `tests/native-auth.test.ts:L210-L227` | `test` | missing configuration, unavailable database/mail and CSRF or oversized input fail closed |
| `tests/native-auth.test.ts:L229-L239` | `test` | a stalled JSON stream is cancelled at the three-second deadline before any auth state is written |
| `tests/scheduler.test.ts:L13-L18` | `test` | first episode waits 30–60 seconds, next wait starts after finish |
| `tests/scheduler.test.ts:L19-L23` | `test` | hidden wait resumes remaining time without catch-up |
| `tests/scheduler.test.ts:L24-L27` | `test` | hidden episode pauses completion; dispose cancels all timers |
| `tests/scheduler.test.ts:L28-L32` | `test` | no immediate repetition, weighted selection and paused startup |
| `tests/scheduler.test.ts:L33-L36` | `test` | development interruption finishes previous episode and owns one timer |
| `tests/studio-analysis.test.ts:L27-L39` | `test` | analysis contract rejects unbounded work and untrusted derivative paths |
| `tests/studio-analysis.test.ts:L41-L48` | `test` | technical marker times are bounded to declared coverage, including trailing low-volume intervals |
| `tests/studio-analysis.test.ts:L50-L92` | `test` | real FFmpeg analysis preserves originals and reports technical aids without semantic labels |
| `tests/studio-analysis.test.ts:L57-L70` | `t.test` | actual black, scene and low-volume measurements plus bounded JPEG thumbnails |
| `tests/studio-analysis.test.ts:L71-L75` | `t.test` | unreviewed toolchain returns unavailable without pretending that analysis succeeded |
| `tests/studio-analysis.test.ts:L76-L78` | `t.test` | range outside original is rejected before publishing any derivative |
| `tests/studio-analysis.test.ts:L79-L86` | `t.test` | audio-only measurement generates no invented video or voice classification |
| `tests/studio-api.test.ts:L29-L68` | `test` | uploads resume after restart, reject conflicting chunks, preserve unsupported originals, and reuse exact duplicates |
| `tests/studio-api.test.ts:L70-L91` | `test` | upload bounds, cancellation and origin guards do not mutate library state |
| `tests/studio-api.test.ts:L93-L124` | `test` | CAS commands, explicit text approval, editable recipes and rights revocation govern export |
| `tests/studio-api.test.ts:L126-L150` | `test` | restart marks incomplete local jobs failed and the prepared D1 migration stays independent of workspace JSON |
| `tests/studio-api.test.ts:L152-L224` | `test` | real local jobs are idempotent, preserve stale previews, require exact-recipe approval and export playable MP4 |
| `tests/studio-api.test.ts:L226-L276` | `test` | text approval atomically records immutable usage and older-than-list history remains counted |
| `tests/studio-api.test.ts:L278-L295` | `test` | local explicit audio analysis caches actual bounded signals without changing human classifications |
| `tests/studio-api.test.ts:L297-L314` | `test` | local owner settings persist defaults and revisions while storage caps preserve saved originals |
| `tests/studio-hosted.test.ts:L87-L105` | `test` | hosted normalized D1 stores text campaign, version receipts and permission-bound export without media compute |
| `tests/studio-hosted.test.ts:L107-L117` | `test` | private R2 resumable uploads deduplicate actual streamed processor hash and retain technical audio semantics |
| `tests/studio-hosted.test.ts:L119-L130` | `test` | D1 upload claim prevents duplicate chunks, rejects short nonfinal parts and resumes committed offsets |
| `tests/studio-hosted.test.ts:L132-L147` | `test` | render admission, durable execution, revision-specific approval and historical export use immutable receipts |
| `tests/studio-hosted.test.ts:L149-L160` | `test` | compute failures keep originals, return safe errors, charge once and require an explicit new operation |
| `tests/studio-hosted.test.ts:L162-L173` | `test` | failed and expired render leases never repeat paid work and release reservations exactly once |
| `tests/studio-hosted.test.ts:L175-L188` | `test` | successful probe is reused after a failed state commit and lost enqueue acknowledgement reuses one reservation |
| `tests/studio-hosted.test.ts:L190-L200` | `test` | state CAS, cross-store workspace revision and atomic rollback preserve the last committed library |
| `tests/studio-hosted.test.ts:L202-L212` | `test` | upload admission is atomic with a recoverable session before any R2 call, including interruption and unavailable multipart creation |
| `tests/studio-hosted.test.ts:L214-L223` | `test` | cancellation retries known already-aborted multipart after database rollback while retaining reservations on service failure |
| `tests/studio-hosted.test.ts:L225-L234` | `test` | render admission commits budget, storage reservation and recoverable job atomically before enqueue |
| `tests/studio-hosted.test.ts:L236-L246` | `test` | method/origin/storage gates reject before consuming media or budget |
| `tests/studio-hosted.test.ts:L248-L261` | `test` | actual owner auth denies a distinct non-owner actor and forged session before hosted Studio access |
| `tests/studio-hosted.test.ts:L263-L278` | `test` | planner previews are free, server-recomputed saves reject stale fingerprints and preserve trusted provenance |
| `tests/studio-hosted.test.ts:L280-L285` | `test` | hosted analysis remains disabled until a reviewed native toolchain is pinned |
| `tests/studio-hosted.test.ts:L297-L328` | `test` | prepared analysis admission is atomic, cache hits are free and reservations reconcile once |
| `tests/studio-hosted.test.ts:L330-L338` | `test` | historical planner ceiling never blocks manual render, approval or export |
| `tests/studio-hosted.test.ts:L340-L356` | `test` | analysis admission rejects an active upload atomically while its completion probe retains ownership |
| `tests/studio-hosted.test.ts:L358-L378` | `test` | owner settings validate exact fields, preserve usage and apply budget/storage caps without deleting originals |
| `tests/studio-hosted.test.ts:L380-L396` | `test` | settings CAS and upload admission serialize against current limits; active work prevents policy changes |
| `tests/studio-planner.test.ts:L27-L37` | `test` | planner is deterministic and proposes one human-marked cooking background without mutating inputs |
| `tests/studio-planner.test.ts:L39-L48` | `test` | bounded alternatives and integer allocation reserve two seconds for each later segment |
| `tests/studio-planner.test.ts:L50-L59` | `test` | human speech locks preserve exact ranges/order and overfull locks abstain |
| `tests/studio-planner.test.ts:L61-L67` | `test` | unconfirmed speech and unclassified raw video are never auto-cut while keeping audio |
| `tests/studio-planner.test.ts:L69-L72` | `test` | muted background requires explicit consent even when speech was not detected |
| `tests/studio-planner.test.ts:L74-L86` | `test` | ready status, product scope, rights and explicit license review are server-side eligibility |
| `tests/studio-planner.test.ts:L88-L98` | `test` | reuse uses original SHA and interval across duplicate entries and historical deleted variants |
| `tests/studio-planner.test.ts:L100-L105` | `test` | overlapping copies cannot silently loop within a single recipe |
| `tests/studio-planner.test.ts:L107-L119` | `test` | planner does not develop vague ideas and preserves ready text literally |
| `tests/studio-planner.test.ts:L121-L126` | `test` | readability rejects valid-length copy that cannot be read in its time slot |
| `tests/studio-planner.test.ts:L128-L135` | `test` | client provenance is ignored; only trusted current-revision plan may be persisted |
| `tests/studio-planner.test.ts:L137-L146` | `test` | human classification changes invalidate planned rendering even without contentVersion changes |
| `tests/studio-planner.test.ts:L148-L155` | `test` | manual edits retain trusted provenance and fresh historical reuse still blocks effects |
| `tests/studio-planner.test.ts:L157-L162` | `test` | invalid pools and incompatible locks fail with bounded domain errors |
| `tests/studio-planner.test.ts:L164-L179` | `test` | replanning an existing variant refreshes replaced originals and invalidates its old approval |
| `tests/studio-planner.test.ts:L181-L190` | `test` | explicit narration replaces unknown source audio but must cover the full recipe |
| `tests/studio-planner.test.ts:L192-L202` | `test` | used intervals leave deterministic unused windows without copying unrelated history into provenance |
| `tests/studio-planner.test.ts:L204-L214` | `test` | optional analysis references are bounded provenance and do not silently change cuts or human speech |
| `tests/studio-processor.test.ts:L27-L78` | `test` | hosted runner probes originals, renders and streams the actual reusable FFmpeg output |
| `tests/studio-processor.test.ts:L128-L136` | `test` | DO durably deduplicates jobs, retains queue during work and does not repeat failed work |
| `tests/studio-processor.test.ts:L137-L147` | `test` | DO preserves infrastructure failures through one watchdog and parks until an explicit same-ID request |
| `tests/studio-processor.test.ts:L148-L157` | `test` | DO serializes native operations, destroys scratch after each and rejects arbitrary object keys |
| `tests/studio-processor.test.ts:L158-L166` | `test` | DO stops failed container work and leaves the next explicit operation usable |
| `tests/studio-processor.test.ts:L167-L192` | `test` | DO streams exact bounded MP4 and cover bytes into private R2 without a media buffer |
| `tests/studio-processor.test.ts:L193-L202` | `test` | DO aggregate deadline includes startup and destroys the entire container |
| `tests/studio-processor.test.ts:L203-L219` | `test` | DO diagnostic logs identify fixed failing stage and exit code without exposing process output |
| `tests/studio-processor.test.ts:L220-L238` | `test` | DO accepts font bytes without Content-Length and preserves them while rejecting oversized or HTML assets |
| `tests/studio-render.test.ts:L35-L123` | `test` | native FFprobe and FFmpeg process bounded synthetic sources and deterministic editable recipes |
| `tests/studio-render.test.ts:L44-L68` | `t.test` | metadata describes actual tracks, dimensions and duration without a semantic classification |
| `tests/studio-render.test.ts:L70-L84` | `t.test` | mixed video/image montage has exact duration, real cover, original custody and source audio control |
| `tests/studio-render.test.ts:L86-L106` | `t.test` | all five template types produce decodable output; mute and selected narration remain distinct |
| `tests/studio-render.test.ts:L108-L121` | `t.test` | reject invalid ranges, unreadable text, remote input, unsupported content and missing tools before success |
| `tests/studio-vite.test.ts:L24-L166` | `test` | isolated real Vite HTTP boundary assembles three fictional campaigns, exports, and serializes product protection |
| `tests/studio-vite.test.ts:L62-L121` | `t.test` | real multipart route bridge uploads a photo and prepares all three account-free examples |
| `tests/studio-vite.test.ts:L123-L137` | `t.test` | serialized legacy deletion and studio creation cannot leave an orphan product |
| `tests/studio-vite.test.ts:L139-L157` | `t.test` | HTTP parsing, origin and private-file denials keep prior state intact |
| `tests/studio-watch.test.ts:L8-L48` | `test` | actual Vite watcher observes source changes but excludes transient private media |
| `tests/studio.test.ts:L27-L36` | `test` | capture accepts an unassigned incomplete idea and separates audio from speech |
| `tests/studio.test.ts:L38-L45` | `test` | campaign preparation needs a real product but no social account, sources or complete objective |
| `tests/studio.test.ts:L47-L58` | `test` | recipes preserve exact source versions and labels remain editable after reuse |
| `tests/studio.test.ts:L60-L72` | `test` | changing source content versions does not rewrite an existing recipe |
| `tests/studio.test.ts:L74-L91` | `test` | video approval requires a trusted exact-revision render and invalidates on editing |
| `tests/studio.test.ts:L93-L102` | `test` | unknown rights, undeveloped ideas and absent manual copy cannot be approved |
| `tests/studio.test.ts:L104-L113` | `test` | render specs preserve explicit ranges and do not treat silence as semantic classification |
| `tests/studio.test.ts:L115-L128` | `test` | invalid ranges, excessive clips, unsupported originals and injected enums fail closed |
| `tests/studio.test.ts:L130-L141` | `test` | old recipes retain their original file even if the material is replaced by a different type |
| `tests/studio.test.ts:L143-L151` | `test` | rights revocation removes approval and export access without changing saved source bytes |
| `tests/studio.test.ts:L153-L164` | `test` | narrated demo requires confirmed voice or a sufficiently long uploaded narration |
| `tests/studio.test.ts:L166-L174` | `test` | asset registration is immutable, malformed requests do not mutate previous state |
| `tests/studio.test.ts:L176-L195` | `test` | legacy import captures trusted immutable source provenance, including original spacing |
| `tests/studio.test.ts:L197-L210` | `test` | replacement rights cannot authorize a restricted historical original |
| `tests/studio.test.ts:L212-L221` | `test` | an owned historical original remains intentional while current revocation still prevents export |
| `tests/ui-help.test.ts:L17-L31` | `test` | every guide has bilingual instructions and only existing declared screenshots |
| `tests/ui-help.test.ts:L33-L43` | `test` | settings explains shared saving, budget allocations and the inactive AI boundary in both languages |
| `tests/ui-help.test.ts:L45-L59` | `test` | assembly help distinguishes proposal, technical aids, exact review and manual publication |
| `tests/ui-help.test.ts:L61-L76` | `test` | text-only guide steps render without broken images and illustrated legacy editors remain usable |

Machine-readable equivalent: [test-declarations.json](test-declarations.json).
