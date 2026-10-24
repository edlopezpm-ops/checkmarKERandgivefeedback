# API route reference

30 curated method/path contracts, including two inactive compatibility helper routes. This is a static source contract, not a live endpoint probe. Braced IDs represent regex captures. Captured IDs are validated; optional suffixes and operation alternatives are expanded below. The active Worker entry uses native owner auth and D1. Loopback endpoints are protected by the Vite Host/IP/origin boundary.

| Method | Path/pattern | Adapter | Behavior | Source |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/request` | native hosted auth | Owner-only generic code request; challenge cookie and email. | `server/native-auth.js:L4` |
| POST | `/api/auth/verify` | native hosted auth | Single-use code and same-browser challenge; creates opaque session. | `server/native-auth.js:L5` |
| POST | `/api/auth/logout` | native hosted auth | Revokes owner session and clears cookies. | `server/native-auth.js:L6` |
| POST | `/api/auth/help` | native hosted auth | Rate-limited bilingual access instructions with generic response. | `server/native-auth.js:L7` |
| GET | `/api/session` | native hosted + local | Session status; native owner state or loopback local status. | `server/worker.ts:L119`; `vite.config.ts:L102` |
| GET | `/api/workspace` | native hosted + local | Read legacy editorial aggregate. | `server/api.ts:L62` |
| POST | `/api/commands` | native hosted + local | Revision-bound legacy editorial command. | `server/api.ts:L64` |
| GET | `/api/studio/settings` | native hosted + local | Settings, actual usage, configured limits and AI disconnected flag. | `server/studio-hosted.ts:L546`; `server/studio-local.ts:L477` |
| POST | `/api/studio/settings` | native hosted + local | Strict settings CAS; active work blocks policy mutation. | `server/studio-hosted.ts:L547`; `server/studio-local.ts:L478` |
| GET | `/api/studio` | native hosted + local | Library/campaign/variant state, jobs, uploads, usage and capabilities. | `server/studio-hosted.ts:L548`; `server/studio-local.ts:L479` |
| POST | `/api/studio/plan` | native hosted + local | Deterministic proposal preview without enqueuing a render. | `server/studio-hosted.ts:L553`; `server/studio-local.ts:L483` |
| POST | `/api/studio/commands` | native hosted + local | Studio revision-bound command; trusted proposal recomputation on save. | `server/studio-hosted.ts:L573`; `server/studio-local.ts:L503` |
| POST | `/api/studio/analyses` | native hosted + local | Explicit technical analysis admission; hosted unavailable until native version pinned. | `server/studio-hosted.ts:L558`; `server/studio-local.ts:L489` |
| GET | `/api/studio/analyses?assetId={id}` | native hosted + local | Up to 20 summaries for an asset. | `server/studio-hosted.ts:L559`; `server/studio-local.ts:L490` |
| GET | `/api/studio/analyses/{id}` | native hosted + local | One analysis record. | `server/studio-hosted.ts:L564`; `server/studio-local.ts:L494` |
| GET | `/api/studio/analyses/{id}/thumb-{0..5}.jpg` | native hosted + local | Completed declared analysis thumbnail. | `server/studio-hosted.ts:L564`; `server/studio-local.ts:L494` |
| POST | `/api/studio/uploads` | native hosted + local | Reserve one resumable upload session. | `server/studio-hosted.ts:L596`; `server/studio-local.ts:L528` |
| GET | `/api/studio/uploads/{id}` | native hosted + local | Read committed upload offset and state. | `server/studio-hosted.ts:L597`; `server/studio-local.ts:L540` |
| PUT | `/api/studio/uploads/{id}` | native hosted + local | Append bounded chunk at exact offset. | `server/studio-hosted.ts:L597`; `server/studio-local.ts:L540` |
| DELETE | `/api/studio/uploads/{id}` | native hosted + local | Cancel upload; preserve failed-release reservations until reconciled. | `server/studio-hosted.ts:L597`; `server/studio-local.ts:L540` |
| POST | `/api/studio/uploads/{id}/complete` | native hosted + local | Probe/hash original, deduplicate and commit metadata. | `server/studio-hosted.ts:L597`; `server/studio-local.ts:L540` |
| GET | `/api/studio/assets/{id}` | native hosted + local | Original bytes; download=1 requests attachment disposition. | `server/studio-hosted.ts:L626`; `server/studio-local.ts:L553` |
| GET | `/api/studio/jobs/{id}` | native hosted + local | Job state and immutable receipt when present. | `server/studio-hosted.ts:L632`; `server/studio-local.ts:L559` |
| GET | `/api/studio/jobs/{id}/video` | native hosted + local | Completed MP4 preview bytes. | `server/studio-hosted.ts:L632`; `server/studio-local.ts:L559` |
| GET | `/api/studio/jobs/{id}/cover` | native hosted + local | Completed cover PNG. | `server/studio-hosted.ts:L632`; `server/studio-local.ts:L559` |
| POST | `/api/studio/variants/{id}/render` | native hosted + local | Exact recipe render admission with explicit regeneration semantics. | `server/studio-hosted.ts:L639`; `server/studio-local.ts:L568` |
| POST | `/api/studio/variants/{id}/approve` | native hosted + local | Explicit confirmed exact recipe/job approval. | `server/studio-hosted.ts:L639`; `server/studio-local.ts:L568` |
| GET | `/api/studio/variants/{id}/export` | native hosted + local | Permission-bound approved TXT or MP4 export. | `server/studio-hosted.ts:L639`; `server/studio-local.ts:L568` |
| POST | `/api/login` | inactive Supabase helper | Prepared Supabase compatibility helper; not selected by exported native Worker. | `server/worker.ts:L39` |
| POST | `/api/logout` | inactive Supabase helper | Prepared Supabase compatibility helper; not selected by exported native Worker. | `server/worker.ts:L34` |

## Routing limits and guards

The current hosted entry delegates only `/api/` requests to native API routing; other paths use static assets. Native `/api/auth/*` permits only POST and recognized auth operations. `/api/session` supports GET. All remaining native operations require the configured owner session. Studio requires media and processor bindings, then its own canonical-origin/method checks. Local session interception matches the exact raw request URL and is behind loopback checks; its compatibility code does not add hosted login endpoints.

Studio dynamic route regular expressions capture one slash-free ID and explicit optional suffixes. Supported methods depend on each branch; a prefix or regex match does not grant every method. The global hosted Studio gate admits only GET/POST/PUT/DELETE before branch dispatch. Source regex occurrences and other API literals are available in [route-occurrences.json](route-occurrences.json); their list deliberately includes tests and client calls and must not be counted as supported endpoints. This catalog does not infer dynamic network destinations, CORS behavior or runtime availability.

The legacy `hostedApi` function in `server/worker.ts` can implement Supabase login/logout/session/editorial access when called with configuration, but the default Worker fetch path calls `nativeApi`. The inactive Supabase helper also handles `/api/session`; its condition does not restrict the method after its same-origin gate. It is retained as preparation, not a second live authentication claim.
