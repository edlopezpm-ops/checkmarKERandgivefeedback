# Test declaration index

292 static declarations across 39 files. Includes subtests; this is neither execution count nor code coverage.

| File | Declarations |
| --- | --- |
| [tests/access-help.test.ts](../source/tests/access-help.test.ts) | 7 |
| [tests/agent-bridge.test.ts](../source/tests/agent-bridge.test.ts) | 12 |
| [tests/agent-context.test.ts](../source/tests/agent-context.test.ts) | 2 |
| [tests/agent-stream.test.ts](../source/tests/agent-stream.test.ts) | 2 |
| [tests/agents-studio.test.ts](../source/tests/agents-studio.test.ts) | 1 |
| [tests/agents-worker.test.ts](../source/tests/agents-worker.test.ts) | 1 |
| [tests/agents.test.ts](../source/tests/agents.test.ts) | 12 |
| [tests/assets.test.ts](../source/tests/assets.test.ts) | 6 |
| [tests/captcha.test.ts](../source/tests/captcha.test.ts) | 10 |
| [tests/d1-hosted.test.ts](../source/tests/d1-hosted.test.ts) | 3 |
| [tests/demo-media.test.ts](../source/tests/demo-media.test.ts) | 12 |
| [tests/editorial.test.ts](../source/tests/editorial.test.ts) | 8 |
| [tests/generation.test.ts](../source/tests/generation.test.ts) | 6 |
| [tests/github-auth.test.ts](../source/tests/github-auth.test.ts) | 6 |
| [tests/google-auth.test.ts](../source/tests/google-auth.test.ts) | 11 |
| [tests/hosted.test.ts](../source/tests/hosted.test.ts) | 2 |
| [tests/mcp-auth.test.ts](../source/tests/mcp-auth.test.ts) | 15 |
| [tests/mcp-integration.test.ts](../source/tests/mcp-integration.test.ts) | 4 |
| [tests/mcp-tools.test.ts](../source/tests/mcp-tools.test.ts) | 8 |
| [tests/motion.test.ts](../source/tests/motion.test.ts) | 5 |
| [tests/native-auth.test.ts](../source/tests/native-auth.test.ts) | 12 |
| [tests/profile-local.test.ts](../source/tests/profile-local.test.ts) | 3 |
| [tests/profile-ui.test.ts](../source/tests/profile-ui.test.ts) | 12 |
| [tests/profile.test.ts](../source/tests/profile.test.ts) | 11 |
| [tests/scheduler.test.ts](../source/tests/scheduler.test.ts) | 5 |
| [tests/studio-analysis.test.ts](../source/tests/studio-analysis.test.ts) | 7 |
| [tests/studio-api.test.ts](../source/tests/studio-api.test.ts) | 8 |
| [tests/studio-classification.test.ts](../source/tests/studio-classification.test.ts) | 4 |
| [tests/studio-hosted.test.ts](../source/tests/studio-hosted.test.ts) | 21 |
| [tests/studio-native-flow.test.ts](../source/tests/studio-native-flow.test.ts) | 1 |
| [tests/studio-native-ui.test.ts](../source/tests/studio-native-ui.test.ts) | 7 |
| [tests/studio-planner.test.ts](../source/tests/studio-planner.test.ts) | 23 |
| [tests/studio-processor.test.ts](../source/tests/studio-processor.test.ts) | 12 |
| [tests/studio-render.test.ts](../source/tests/studio-render.test.ts) | 5 |
| [tests/studio-vite.test.ts](../source/tests/studio-vite.test.ts) | 4 |
| [tests/studio-watch.test.ts](../source/tests/studio-watch.test.ts) | 1 |
| [tests/studio.test.ts](../source/tests/studio.test.ts) | 15 |
| [tests/turnstile-ui.test.ts](../source/tests/turnstile-ui.test.ts) | 5 |
| [tests/ui-help.test.ts](../source/tests/ui-help.test.ts) | 3 |

## Declarations

| Source | Kind | Declared intent |
| --- | --- | --- |
| [tests/access-help.test.ts:55](../source/tests/access-help.test.ts#L55) | test | help sends the English guide only to the configured owner and returns generic responses without cookies |
| [tests/access-help.test.ts:73](../source/tests/access-help.test.ts#L73) | test | help sends Spanish instructions without changing existing challenges, sessions or login limits |
| [tests/access-help.test.ts:89](../source/tests/access-help.test.ts#L89) | test | help enforces origin, method, schema, JSON and bounded body before mail or counter writes |
| [tests/access-help.test.ts:107](../source/tests/access-help.test.ts#L107) | test | help cooldown and concurrent requests admit one mail, and IP admission is bounded |
| [tests/access-help.test.ts:118](../source/tests/access-help.test.ts#L118) | test | help global hourly admission limits rotating IP addresses without sending to unknown identities |
| [tests/access-help.test.ts:125](../source/tests/access-help.test.ts#L125) | test | help owner hourly and daily limits bound actual mail independently of IP and code requests |
| [tests/access-help.test.ts:138](../source/tests/access-help.test.ts#L138) | test | help provider failure is visible without leaking details or mutating auth state; SQL failure rolls back quotas |
| [tests/agent-bridge.test.ts:13](../source/tests/agent-bridge.test.ts#L13) | test | native account connector rejects hosted origins and ambiguous origin credentials |
| [tests/agent-bridge.test.ts:22](../source/tests/agent-bridge.test.ts#L22) | test | child receives no API, pairing, or inherited application credentials |
| [tests/agent-bridge.test.ts:35](../source/tests/agent-bridge.test.ts#L35) | test | API billing and unauthenticated native sessions fail closed |
| [tests/agent-bridge.test.ts:41](../source/tests/agent-bridge.test.ts#L41) | test | structured output validation rejects malformed, excessive, and nontext proposals |
| [tests/agent-bridge.test.ts:48](../source/tests/agent-bridge.test.ts#L48) | test | fresh native threads receive the bounded conversation history and exact Studio snapshot |
| [tests/agent-bridge.test.ts:106](../source/tests/agent-bridge.test.ts#L106) | test | stdio integration validates completion, forwards actual deltas, and uses ephemeral no-tool thread |
| [tests/agent-bridge.test.ts:122](../source/tests/agent-bridge.test.ts#L122) | test | inherited MCP config is explicitly disabled before a thread can start |
| [tests/agent-bridge.test.ts:131](../source/tests/agent-bridge.test.ts#L131) | test | failed turns, invalid JSON, workspace instructions, and prohibited tool events cannot report success |
| [tests/agent-bridge.test.ts:140](../source/tests/agent-bridge.test.ts#L140) | test | cancellation sends turn/interrupt and distinguishes interrupted from completed |
| [tests/agent-bridge.test.ts:150](../source/tests/agent-bridge.test.ts#L150) | test | bridge HTTP requests refuse redirects and expose only pairing bearer auth |
| [tests/agent-bridge.test.ts:162](../source/tests/agent-bridge.test.ts#L162) | test | lost completion response replays the durable receipt without repeating inference |
| [tests/agent-bridge.test.ts:185](../source/tests/agent-bridge.test.ts#L185) | test | run duration follows the admitted server deadline and expired requests never invoke the provider |
| [tests/agent-context.test.ts:5](../source/tests/agent-context.test.ts#L5) | test | recipe revision drift is visible even when the same variant and materials stay selected |
| [tests/agent-context.test.ts:11](../source/tests/agent-context.test.ts#L11) | test | removed captured recipes differ from a Studio snapshot that has not loaded |
| [tests/agent-stream.test.ts:5](../source/tests/agent-stream.test.ts#L5) | test | structured streaming shows natural message while keeping proposal JSON hidden |
| [tests/agent-stream.test.ts:18](../source/tests/agent-stream.test.ts#L18) | test | partial escaped characters and reordered final JSON never expose schema |
| [tests/agents-studio.test.ts:10](../source/tests/agents-studio.test.ts#L10) | test | trusted agent save retains provenance through edits, source snapshots, approval and export; HTTP fields cannot forge it |
| [tests/agents-worker.test.ts:7](../source/tests/agents-worker.test.ts#L7) | test | Worker owner session and bridge bearer remain separate; D1 pairing is durable and revocable |
| [tests/agents.test.ts:75](../source/tests/agents.test.ts#L75) | test | agent bridge is separate, revocable and subscription-only; context is derived from exact Studio selection |
| [tests/agents.test.ts:91](../source/tests/agents.test.ts#L91) | test | agent proposal/edit/history survives reload; completion and lost material response recover once |
| [tests/agents.test.ts:110](../source/tests/agents.test.ts#L110) | test | source metadata changes are detected independently of unrelated Studio revision changes |
| [tests/agents.test.ts:122](../source/tests/agents.test.ts#L122) | test | agent planner applies a recomputed variant once, updates it and records approved text export |
| [tests/agents.test.ts:147](../source/tests/agents.test.ts#L147) | test | agent cancellation, timeout and daily limits retain completed results without automatic rerun |
| [tests/agents.test.ts:158](../source/tests/agents.test.ts#L158) | test | D1 adapter and SQLite preserve concurrent request idempotency and recovery before availability checks |
| [tests/agents.test.ts:169](../source/tests/agents.test.ts#L169) | test | streamed agent deltas preserve exact spaces, whitespace-only chunks and line breaks |
| [tests/agents.test.ts:183](../source/tests/agents.test.ts#L183) | test | offline completed receipts reconcile the original expired run without new inference or proposals |
| [tests/agents.test.ts:201](../source/tests/agents.test.ts#L201) | test | late reconciliation cannot reopen explicit provider failure, cancellation or revoked connection |
| [tests/agents.test.ts:212](../source/tests/agents.test.ts#L212) | test | actual bridge receipt replay clears an uncommitted timed-out result without invoking inference |
| [tests/agents.test.ts:226](../source/tests/agents.test.ts#L226) | test | selected variant recipe drift blocks old proposals; unrelated edits and own planner receipts remain valid |
| [tests/agents.test.ts:243](../source/tests/agents.test.ts#L243) | test | variant-only context derives its Studio campaign/product and rejects a mismatched explicit product |
| [tests/assets.test.ts:14](../source/tests/assets.test.ts#L14) | test | default/rejected consent loads once in memory with no persistent writes |
| [tests/assets.test.ts:18](../source/tests/assets.test.ts#L18) | test | acceptance caches resource, cleans old versions and revocation preserves other caches |
| [tests/assets.test.ts:23](../source/tests/assets.test.ts#L23) | test | unavailable storage and quota failure fall back to host |
| [tests/assets.test.ts:28](../source/tests/assets.test.ts#L28) | test | revocation during network load never leaves an optional copy |
| [tests/assets.test.ts:33](../source/tests/assets.test.ts#L33) | test | oversized declared and streaming bodies are rejected |
| [tests/assets.test.ts:37](../source/tests/assets.test.ts#L37) | test | network failure clears failed memoization for recovery |
| [tests/captcha.test.ts:16](../source/tests/captcha.test.ts#L16) | test | completely absent CAPTCHA preserves existing auth; partial configuration fails closed without a request |
| [tests/captcha.test.ts:30](../source/tests/captcha.test.ts#L30) | test | canonical verification uses fixed endpoint, action, hostname and local one-use proofs even when provider repeats success |
| [tests/captcha.test.ts:41](../source/tests/captcha.test.ts#L41) | test | provider success requires boolean true plus exact action and exact production hostname |
| [tests/captcha.test.ts:54](../source/tests/captcha.test.ts#L54) | test | invalid token, origin, hostname configuration and unknown path do not contact the provider |
| [tests/captcha.test.ts:66](../source/tests/captcha.test.ts#L66) | test | transport, malformed, oversized and redirect responses fail closed |
| [tests/captcha.test.ts:76](../source/tests/captcha.test.ts#L76) | test | atomic local proof custody accepts one concurrent request and prevents reuse across every auth route |
| [tests/captcha.test.ts:84](../source/tests/captcha.test.ts#L84) | test | proof crossing midnight survives native cleanup until provider expiry has passed |
| [tests/captcha.test.ts:93](../source/tests/captcha.test.ts#L93) | test | proof store SQL failure, missing custody configuration and row capacity fail closed |
| [tests/captcha.test.ts:101](../source/tests/captcha.test.ts#L101) | test | capacity recovers on the next day while preserving a crossing-midnight proof and current quotas |
| [tests/captcha.test.ts:114](../source/tests/captcha.test.ts#L114) | test | proof admission transaction rolls back expired-row cleanup when insertion fails |
| [tests/d1-hosted.test.ts:28](../source/tests/d1-hosted.test.ts#L28) | test | actual SQLite schema and hosted repository keep CAS conflict and payload limit without lost records |
| [tests/d1-hosted.test.ts:37](../source/tests/d1-hosted.test.ts#L37) | test | hosted product deletion cannot orphan Studio material or campaign in either committed order |
| [tests/d1-hosted.test.ts:55](../source/tests/d1-hosted.test.ts#L55) | test | native auth plus data API completes owner login/write/logout and denies non-owner requests using actual SQL |
| [tests/demo-media.test.ts:18](../source/tests/demo-media.test.ts#L18) | test | only the two immutable public movies and GET/HEAD select the media handler |
| [tests/demo-media.test.ts:27](../source/tests/demo-media.test.ts#L27) | test | complete GET preserves the movie bytes and advertises byte ranges |
| [tests/demo-media.test.ts:35](../source/tests/demo-media.test.ts#L35) | test | single, suffix and open-ended ranges return exact bytes and HTTP metadata |
| [tests/demo-media.test.ts:47](../source/tests/demo-media.test.ts#L47) | test | HEAD ignores Range, returns no body and cancels any upstream body |
| [tests/demo-media.test.ts:57](../source/tests/demo-media.test.ts#L57) | test | malformed or multipart ranges return the complete movie |
| [tests/demo-media.test.ts:65](../source/tests/demo-media.test.ts#L65) | test | unsatisfiable ranges return 416, empty body and complete length |
| [tests/demo-media.test.ts:75](../source/tests/demo-media.test.ts#L75) | test | If-Range permits matching strong validators and falls back for changed/weak validators |
| [tests/demo-media.test.ts:84](../source/tests/demo-media.test.ts#L84) | test | missing asset Content-Length uses the frozen film lengths and original bytes |
| [tests/demo-media.test.ts:94](../source/tests/demo-media.test.ts#L94) | test | non-200 asset responses pass through without manufacturing a range |
| [tests/demo-media.test.ts:103](../source/tests/demo-media.test.ts#L103) | test | a small range cancels the remaining upstream movie instead of reading it all |
| [tests/demo-media.test.ts:112](../source/tests/demo-media.test.ts#L112) | test | downstream cancellation propagates to the upstream movie |
| [tests/demo-media.test.ts:122](../source/tests/demo-media.test.ts#L122) | test | an interrupted upstream range rejects instead of silently returning truncated bytes |
| [tests/editorial.test.ts:63](../source/tests/editorial.test.ts#L63) | test | manual editorial cycle preserves original whitespace, source references and explicit result evidence |
| [tests/editorial.test.ts:114](../source/tests/editorial.test.ts#L114) | test | shared account prevents equal absolute schedules across products and sources outlive one campaign |
| [tests/editorial.test.ts:156](../source/tests/editorial.test.ts#L156) | test | relationships reject foreign sources, incompatible accounts and destructive dependency changes |
| [tests/editorial.test.ts:193](../source/tests/editorial.test.ts#L193) | test | paid plans always start paused, require explicit budget/currency and cannot activate spending |
| [tests/editorial.test.ts:215](../source/tests/editorial.test.ts#L215) | test | readiness cannot be forged for empty/unreviewed or multimedia-only destinations |
| [tests/editorial.test.ts:251](../source/tests/editorial.test.ts#L251) | test | invalid input never mutates the prior state or invents records |
| [tests/editorial.test.ts:285](../source/tests/editorial.test.ts#L285) | test | bounded API rejects non-JSON, oversized streaming payloads and cross-origin writes |
| [tests/editorial.test.ts:314](../source/tests/editorial.test.ts#L314) | test | concurrent local writes reject stale revisions, persist across instances and never overwrite corrupt state |
| [tests/generation.test.ts:33](../source/tests/generation.test.ts#L33) | test | all three fictional examples generate editable simulated drafts with exact source IDs and paused paid state |
| [tests/generation.test.ts:60](../source/tests/generation.test.ts#L60) | test | concurrent duplicates share one result; changed input or snapshot cannot reuse the request ID |
| [tests/generation.test.ts:74](../source/tests/generation.test.ts#L74) | test | missing, cross-product and non-campaign sources, incompatible destination and stale revision are rejected |
| [tests/generation.test.ts:90](../source/tests/generation.test.ts#L90) | test | simulated errors, timeout, cancellation and malformed results never change the workspace |
| [tests/generation.test.ts:103](../source/tests/generation.test.ts#L103) | test | saving after external edits and generation-time mutations is rejected; original schedule is preserved |
| [tests/generation.test.ts:119](../source/tests/generation.test.ts#L119) | test | bounded session expiry, capacity, output size and clear reject retained or pending work |
| [tests/github-auth.test.ts:41](../source/tests/github-auth.test.ts#L41) | test | GitHub optional readiness and explicit fresh-email linking preserve one retained operator with no email match |
| [tests/github-auth.test.ts:55](../source/tests/github-auth.test.ts#L55) | test | GitHub flow browser/provider binding, replay, native proof freshness and revocation fail closed |
| [tests/github-auth.test.ts:68](../source/tests/github-auth.test.ts#L68) | test | GitHub requires authenticated positive safe numeric User identity and rejects redirects or provider error bodies |
| [tests/github-auth.test.ts:80](../source/tests/github-auth.test.ts#L80) | test | concurrent GitHub first-link flows retain one binding and deny the other durable ID |
| [tests/github-auth.test.ts:88](../source/tests/github-auth.test.ts#L88) | test | GitHub CAPTCHA gate runs before any flow reservation and refuses partial or failed configuration |
| [tests/github-auth.test.ts:95](../source/tests/github-auth.test.ts#L95) | test | migration 0008 preserves existing Google/email principals, identity, active Google flow and business bytes |
| [tests/google-auth.test.ts:52](../source/tests/google-auth.test.ts#L52) | test | dedicated optional Google configuration is honest and never creates a first identity from email equality |
| [tests/google-auth.test.ts:61](../source/tests/google-auth.test.ts#L61) | test | fresh email proof links immutable Google subject; Google signs in to the retained singleton without the Strict cookie |
| [tests/google-auth.test.ts:75](../source/tests/google-auth.test.ts#L75) | test | binding requires same browser, a still-active original email session and proof younger than five minutes |
| [tests/google-auth.test.ts:85](../source/tests/google-auth.test.ts#L85) | test | provider proof validates signature issuer audience azp nonce timestamps and verified identity before binding |
| [tests/google-auth.test.ts:100](../source/tests/google-auth.test.ts#L100) | test | single-tenant identity upgrades retained sessions without moving data and rejects client-selected tenant or changed operator |
| [tests/google-auth.test.ts:116](../source/tests/google-auth.test.ts#L116) | test | Google linking rechecks fresh proof after provider latency and fails closed on state, CSRF and provider errors |
| [tests/google-auth.test.ts:127](../source/tests/google-auth.test.ts#L127) | test | concurrent first-link flows retain exactly one immutable Google identity and deny the losing subject |
| [tests/google-auth.test.ts:148](../source/tests/google-auth.test.ts#L148) | test | Google authorization response accepts one canonical issuer or legacy omission and rejects mismatched or duplicate issuers before exchange |
| [tests/google-auth.test.ts:159](../source/tests/google-auth.test.ts#L159) | test | token-exchange diagnostics expose only fixed substages, known error classifiers and HTTP status |
| [tests/google-auth.test.ts:175](../source/tests/google-auth.test.ts#L175) | test | Workers manual redirect mode supports successful auth and rejects token or JWKS redirects without following them |
| [tests/google-auth.test.ts:189](../source/tests/google-auth.test.ts#L189) | test | configured CAPTCHA denies Google flow admission before persistence and accepts only its action |
| [tests/hosted.test.ts:10](../source/tests/hosted.test.ts#L10) | test | unconfigured hosted backend fails closed, anonymous and other identities cannot read or write |
| [tests/hosted.test.ts:65](../source/tests/hosted.test.ts#L65) | test | configured owner reads through Supabase and successful login returns HttpOnly cookie without browser tokens |
| [tests/mcp-auth.test.ts:31](../source/tests/mcp-auth.test.ts#L31) | test | MCP discovery names exact resource and PKCE public-client endpoints without owner cookies |
| [tests/mcp-auth.test.ts:40](../source/tests/mcp-auth.test.ts#L40) | test | DCR bounds public metadata and requires exact HTTPS redirects in hosted mode |
| [tests/mcp-auth.test.ts:50](../source/tests/mcp-auth.test.ts#L50) | test | anonymous authorize requests do not grant access; signed-in consent escapes names and preserves original logo |
| [tests/mcp-auth.test.ts:59](../source/tests/mcp-auth.test.ts#L59) | test | authorize rejects redirect substitution, duplicate parameters, unbound resources, PKCE downgrade and unknown scopes |
| [tests/mcp-auth.test.ts:66](../source/tests/mcp-auth.test.ts#L66) | test | consent requires same-origin authenticated owner and single-use explicit Allow or Deny |
| [tests/mcp-auth.test.ts:76](../source/tests/mcp-auth.test.ts#L76) | test | real SQLite code exchange binds PKCE, client, redirect, resource and opaque hashed credentials |
| [tests/mcp-auth.test.ts:88](../source/tests/mcp-auth.test.ts#L88) | test | concurrent code exchanges admit exactly one token pair |
| [tests/mcp-auth.test.ts:94](../source/tests/mcp-auth.test.ts#L94) | test | failed token transaction rolls back code consumption and permits a correct retry |
| [tests/mcp-auth.test.ts:100](../source/tests/mcp-auth.test.ts#L100) | test | refresh rotates once; replay revokes whole grant family including latest access token |
| [tests/mcp-auth.test.ts:107](../source/tests/mcp-auth.test.ts#L107) | test | concurrent refresh races revoke the family rather than leaving replayable credentials |
| [tests/mcp-auth.test.ts:112](../source/tests/mcp-auth.test.ts#L112) | test | cross-client refresh/revoke and scope escalation fail without revoking valid owner grant |
| [tests/mcp-auth.test.ts:120](../source/tests/mcp-auth.test.ts#L120) | test | owner can list and revoke delegated connections; another owner and cross-origin requests cannot |
| [tests/mcp-auth.test.ts:131](../source/tests/mcp-auth.test.ts#L131) | test | RFC revocation accepts access or refresh credentials and makes authentication fail |
| [tests/mcp-auth.test.ts:138](../source/tests/mcp-auth.test.ts#L138) | test | expiry and durable account freeze deny access; migration blocks already-admitted writes |
| [tests/mcp-auth.test.ts:146](../source/tests/mcp-auth.test.ts#L146) | test | endpoints bound methods, bodies, registration rate and do not accept client-secret auth |
| [tests/mcp-integration.test.ts:56](../source/tests/mcp-integration.test.ts#L56) | test | official SDK negotiates Streamable HTTP and persists real tools; duplicate requests never duplicate products |
| [tests/mcp-integration.test.ts:79](../source/tests/mcp-integration.test.ts#L79) | test | transport rejects missing/invalid identity, cross-origin and caller-selected tenant before product effects |
| [tests/mcp-integration.test.ts:90](../source/tests/mcp-integration.test.ts#L90) | test | concurrent identical writes admit once and uncertain committed effects never automatically run again |
| [tests/mcp-integration.test.ts:103](../source/tests/mcp-integration.test.ts#L103) | test | owner revocation invalidates established SDK connections and local authorization persists across factories |
| [tests/mcp-tools.test.ts:33](../source/tests/mcp-tools.test.ts#L33) | test | finite descriptors require bounded closed schemas and declare the business effects |
| [tests/mcp-tools.test.ts:49](../source/tests/mcp-tools.test.ts#L49) | test | real local repository and SQLite: create → literal library plan → save → human approval → TXT export |
| [tests/mcp-tools.test.ts:127](../source/tests/mcp-tools.test.ts#L127) | test | input and grant rejection precede backend effects; no path, tenant, approval or provenance injection |
| [tests/mcp-tools.test.ts:148](../source/tests/mcp-tools.test.ts#L148) | test | native rights, CAS, immutable source history and precise deletion confirmation remain enforced |
| [tests/mcp-tools.test.ts:172](../source/tests/mcp-tools.test.ts#L172) | test | MP4 export verifies the backend and cancels its media stream, returning only an authenticated URI |
| [tests/mcp-tools.test.ts:193](../source/tests/mcp-tools.test.ts#L193) | test | render returns the exact backend job and preserves backend limit/error status without approval |
| [tests/mcp-tools.test.ts:210](../source/tests/mcp-tools.test.ts#L210) | test | material editing preserves trusted generation provenance while external arguments cannot forge it |
| [tests/mcp-tools.test.ts:225](../source/tests/mcp-tools.test.ts#L225) | test | editing checks the initial read revision before merging facts, and concurrent export cancels without delivery |
| [tests/motion.test.ts:10](../source/tests/motion.test.ts#L10) | test | kung fu travels across the stage, jumps and exchanges sides in every variant |
| [tests/motion.test.ts:25](../source/tests/motion.test.ts#L25) | test | genuine side and rear torsos have their own silhouettes and surface pixels |
| [tests/motion.test.ts:38](../source/tests/motion.test.ts#L38) | test | all scenes retain finite bounded motion and a clean return to the same idle pose |
| [tests/motion.test.ts:57](../source/tests/motion.test.ts#L57) | test | episodes vary in two dimensions while cooperative and winning reactions remain coherent |
| [tests/motion.test.ts:68](../source/tests/motion.test.ts#L68) | test | cueca partners circle in depth, escobillan, alternate zapateo and salute without a winner |
| [tests/native-auth.test.ts:70](../source/tests/native-auth.test.ts#L70) | test | native SQLite keeps owner auth separate, sends only allowlisted aliases and stores no raw identities, PINs or cookies |
| [tests/native-auth.test.ts:96](../source/tests/native-auth.test.ts#L96) | test | PIN requires its browser cookie, allows the fifth attempt, consumes once and logout revokes the opaque server session |
| [tests/native-auth.test.ts:116](../source/tests/native-auth.test.ts#L116) | test | locked, expired, cross-browser and duplicate-cookie challenges never create a session |
| [tests/native-auth.test.ts:133](../source/tests/native-auth.test.ts#L133) | test | two concurrent correct verifications consume one challenge and create exactly one session |
| [tests/native-auth.test.ts:143](../source/tests/native-auth.test.ts#L143) | test | an immediate resend preserves the existing browser challenge and the original PIN remains usable |
| [tests/native-auth.test.ts:153](../source/tests/native-auth.test.ts#L153) | test | creation and verification failures roll back challenge, budget and session writes atomically |
| [tests/native-auth.test.ts:169](../source/tests/native-auth.test.ts#L169) | test | session checks enforce canonical origin, allowlist, duplicated cookies, thirty-minute idle and six-hour absolute expiry |
| [tests/native-auth.test.ts:186](../source/tests/native-auth.test.ts#L186) | test | the global hourly request quota is atomic and bounds attacker-created limiter rows |
| [tests/native-auth.test.ts:197](../source/tests/native-auth.test.ts#L197) | test | mail failure has the generic response, invalidates the challenge and does not block HTTP on provider latency |
| [tests/native-auth.test.ts:215](../source/tests/native-auth.test.ts#L215) | test | missing configuration, unavailable database/mail and CSRF or oversized input fail closed |
| [tests/native-auth.test.ts:234](../source/tests/native-auth.test.ts#L234) | test | a stalled JSON stream is cancelled at the three-second deadline before any auth state is written |
| [tests/native-auth.test.ts:246](../source/tests/native-auth.test.ts#L246) | test | configured CAPTCHA refusal precedes native request, verification and access-help writes |
| [tests/profile-local.test.ts:10](../source/tests/profile-local.test.ts#L10) | test | local profile persists optional fields and admits only one concurrent revision |
| [tests/profile-local.test.ts:17](../source/tests/profile-local.test.ts#L17) | test | local profile cannot edit access email or delete the local workspace |
| [tests/profile-local.test.ts:22](../source/tests/profile-local.test.ts#L22) | test | local profile omits unrelated stored properties and fails closed on corrupt storage |
| [tests/profile-ui.test.ts:29](../source/tests/profile-ui.test.ts#L29) | test | profile load and edit do not send mutations; save PATCH preserves readonly access email |
| [tests/profile-ui.test.ts:36](../source/tests/profile-ui.test.ts#L36) | test | saving an edited profile sends the revision captured when editing began |
| [tests/profile-ui.test.ts:42](../source/tests/profile-ui.test.ts#L42) | test | account deletion needs the open confirmation, exact DELETE and all-data affirmation |
| [tests/profile-ui.test.ts:50](../source/tests/profile-ui.test.ts#L50) | test | fresh proof is required even if a caller directly submits a fully filled confirmation |
| [tests/profile-ui.test.ts:55](../source/tests/profile-ui.test.ts#L55) | test | a proof that expires on the server reveals re-verification and blocks another deletion |
| [tests/profile-ui.test.ts:61](../source/tests/profile-ui.test.ts#L61) | test | local profile has no account-deletion control and editing navigation causes no deletion |
| [tests/profile-ui.test.ts:65](../source/tests/profile-ui.test.ts#L65) | test | lost accepted DELETE response recovers with status GET instead of another deletion |
| [tests/profile-ui.test.ts:71](../source/tests/profile-ui.test.ts#L71) | test | deletion recovery reads status before bounded resume and stops at terminal state |
| [tests/profile-ui.test.ts:77](../source/tests/profile-ui.test.ts#L77) | test | failed progress waits for explicit retry and unmount cancels pending resume |
| [tests/profile-ui.test.ts:83](../source/tests/profile-ui.test.ts#L83) | test | automatic initials are displayed from the persisted server profile and never editable |
| [tests/profile-ui.test.ts:88](../source/tests/profile-ui.test.ts#L88) | test | purged capability status404 resolves terminal deletion through public session without a mutation |
| [tests/profile-ui.test.ts:93](../source/tests/profile-ui.test.ts#L93) | test | lost final resume response resolves the public tombstone and never repeats DELETE |
| [tests/profile.test.ts:39](../source/tests/profile.test.ts#L39) | test | account deletion freezes and removes all delegated MCP credentials and effect receipts |
| [tests/profile.test.ts:58](../source/tests/profile.test.ts#L58) | test | profile derives initials automatically and retains only the readonly access email on owner PATCH with revision CAS |
| [tests/profile.test.ts:84](../source/tests/profile.test.ts#L84) | test | shared automatic initials follow current name or email without an owner-specific default |
| [tests/profile.test.ts:88](../source/tests/profile.test.ts#L88) | test | deletion requires exact double confirmation, fresh independent email, session, origin and singleton tenant |
| [tests/profile.test.ts:105](../source/tests/profile.test.ts#L105) | test | durable freeze, lost-start retry and same-browser cleanup purge all active D1/R2 rows without recreating owner data |
| [tests/profile.test.ts:144](../source/tests/profile.test.ts#L144) | test | cleanup waits existing write leases and retries multipart/R2 failures without a false completion |
| [tests/profile.test.ts:157](../source/tests/profile.test.ts#L157) | test | concurrent resumes hold one durable lease and final D1 purge rolls back atomically on failure |
| [tests/profile.test.ts:170](../source/tests/profile.test.ts#L170) | test | final empty-bucket recheck catches late objects; scheduled recovery completes only an owner-started deletion |
| [tests/profile.test.ts:179](../source/tests/profile.test.ts#L179) | test | missing lifecycle migration fails closed before any auth, bridge, or profile effect |
| [tests/profile.test.ts:185](../source/tests/profile.test.ts#L185) | test | completed or previously aborted multipart uploads permit cleanup only for documented NoSuchUpload errors |
| [tests/profile.test.ts:192](../source/tests/profile.test.ts#L192) | test | additive profile migration preserves existing Google identity, owner/session and workspace bytes; absent lifecycle also freezes D1 writes |
| [tests/scheduler.test.ts:13](../source/tests/scheduler.test.ts#L13) | test | first episode waits 30–60 seconds, next wait starts after finish |
| [tests/scheduler.test.ts:19](../source/tests/scheduler.test.ts#L19) | test | hidden wait resumes remaining time without catch-up |
| [tests/scheduler.test.ts:24](../source/tests/scheduler.test.ts#L24) | test | hidden episode pauses completion; dispose cancels all timers |
| [tests/scheduler.test.ts:28](../source/tests/scheduler.test.ts#L28) | test | no immediate repetition, weighted selection and paused startup |
| [tests/scheduler.test.ts:33](../source/tests/scheduler.test.ts#L33) | test | development interruption finishes previous episode and owns one timer |
| [tests/studio-analysis.test.ts:27](../source/tests/studio-analysis.test.ts#L27) | test | analysis contract rejects unbounded work and untrusted derivative paths |
| [tests/studio-analysis.test.ts:41](../source/tests/studio-analysis.test.ts#L41) | test | technical marker times are bounded to declared coverage, including trailing low-volume intervals |
| [tests/studio-analysis.test.ts:50](../source/tests/studio-analysis.test.ts#L50) | test | real FFmpeg analysis preserves originals and reports technical aids without semantic labels |
| [tests/studio-analysis.test.ts:57](../source/tests/studio-analysis.test.ts#L57) | t.test | actual black, scene and low-volume measurements plus bounded JPEG thumbnails |
| [tests/studio-analysis.test.ts:71](../source/tests/studio-analysis.test.ts#L71) | t.test | unreviewed toolchain returns unavailable without pretending that analysis succeeded |
| [tests/studio-analysis.test.ts:76](../source/tests/studio-analysis.test.ts#L76) | t.test | range outside original is rejected before publishing any derivative |
| [tests/studio-analysis.test.ts:79](../source/tests/studio-analysis.test.ts#L79) | t.test | audio-only measurement generates no invented video or voice classification |
| [tests/studio-api.test.ts:29](../source/tests/studio-api.test.ts#L29) | test | uploads resume after restart, reject conflicting chunks, preserve unsupported originals, and reuse exact duplicates |
| [tests/studio-api.test.ts:70](../source/tests/studio-api.test.ts#L70) | test | upload bounds, cancellation and origin guards do not mutate library state |
| [tests/studio-api.test.ts:93](../source/tests/studio-api.test.ts#L93) | test | CAS commands, explicit text approval, editable recipes and rights revocation govern export |
| [tests/studio-api.test.ts:126](../source/tests/studio-api.test.ts#L126) | test | restart marks incomplete local jobs failed and the prepared D1 migration stays independent of workspace JSON |
| [tests/studio-api.test.ts:152](../source/tests/studio-api.test.ts#L152) | test | real local jobs are idempotent, preserve stale previews, require exact-recipe approval and export playable MP4 |
| [tests/studio-api.test.ts:226](../source/tests/studio-api.test.ts#L226) | test | text approval atomically records immutable usage and older-than-list history remains counted |
| [tests/studio-api.test.ts:278](../source/tests/studio-api.test.ts#L278) | test | local explicit audio analysis caches actual bounded signals without changing human classifications |
| [tests/studio-api.test.ts:297](../source/tests/studio-api.test.ts#L297) | test | local owner settings persist defaults and revisions while storage caps preserve saved originals |
| [tests/studio-classification.test.ts:12](../source/tests/studio-classification.test.ts#L12) | test | classification is pure, deterministic and fills only missing categories or roles |
| [tests/studio-classification.test.ts:23](../source/tests/studio-classification.test.ts#L23) | test | video and voice hints come only from declared names, never audio tracks, content or semantic guesses |
| [tests/studio-classification.test.ts:34](../source/tests/studio-classification.test.ts#L34) | test | new material gets only missing labels while existing edits keep intentional empty fields |
| [tests/studio-classification.test.ts:44](../source/tests/studio-classification.test.ts#L44) | test | explicit batch classification validates the entire bounded selection before changing anything and replays as a no-op |
| [tests/studio-hosted.test.ts:87](../source/tests/studio-hosted.test.ts#L87) | test | hosted normalized D1 stores text campaign, version receipts and permission-bound export without media compute |
| [tests/studio-hosted.test.ts:107](../source/tests/studio-hosted.test.ts#L107) | test | private R2 resumable uploads deduplicate actual streamed processor hash and retain technical audio semantics |
| [tests/studio-hosted.test.ts:119](../source/tests/studio-hosted.test.ts#L119) | test | account freeze aborts a late multipart part and removes an original completed after deletion began |
| [tests/studio-hosted.test.ts:129](../source/tests/studio-hosted.test.ts#L129) | test | D1 upload claim prevents duplicate chunks, rejects short nonfinal parts and resumes committed offsets |
| [tests/studio-hosted.test.ts:142](../source/tests/studio-hosted.test.ts#L142) | test | render admission, durable execution, revision-specific approval and historical export use immutable receipts |
| [tests/studio-hosted.test.ts:159](../source/tests/studio-hosted.test.ts#L159) | test | compute failures keep originals, return safe errors, charge once and require an explicit new operation |
| [tests/studio-hosted.test.ts:172](../source/tests/studio-hosted.test.ts#L172) | test | failed and expired render leases never repeat paid work and release reservations exactly once |
| [tests/studio-hosted.test.ts:185](../source/tests/studio-hosted.test.ts#L185) | test | successful probe is reused after a failed state commit and lost enqueue acknowledgement reuses one reservation |
| [tests/studio-hosted.test.ts:200](../source/tests/studio-hosted.test.ts#L200) | test | state CAS, cross-store workspace revision and atomic rollback preserve the last committed library |
| [tests/studio-hosted.test.ts:212](../source/tests/studio-hosted.test.ts#L212) | test | upload admission is atomic with a recoverable session before any R2 call, including interruption and unavailable multipart creation |
| [tests/studio-hosted.test.ts:224](../source/tests/studio-hosted.test.ts#L224) | test | cancellation retries known already-aborted multipart after database rollback while retaining reservations on service failure |
| [tests/studio-hosted.test.ts:235](../source/tests/studio-hosted.test.ts#L235) | test | render admission commits budget, storage reservation and recoverable job atomically before enqueue |
| [tests/studio-hosted.test.ts:246](../source/tests/studio-hosted.test.ts#L246) | test | method/origin/storage gates reject before consuming media or budget |
| [tests/studio-hosted.test.ts:258](../source/tests/studio-hosted.test.ts#L258) | test | actual owner auth denies a distinct non-owner actor and forged session before hosted Studio access |
| [tests/studio-hosted.test.ts:273](../source/tests/studio-hosted.test.ts#L273) | test | planner previews are free, server-recomputed saves reject stale fingerprints and preserve trusted provenance |
| [tests/studio-hosted.test.ts:290](../source/tests/studio-hosted.test.ts#L290) | test | hosted analysis remains disabled until a reviewed native toolchain is pinned |
| [tests/studio-hosted.test.ts:307](../source/tests/studio-hosted.test.ts#L307) | test | prepared analysis admission is atomic, cache hits are free and reservations reconcile once |
| [tests/studio-hosted.test.ts:340](../source/tests/studio-hosted.test.ts#L340) | test | historical planner ceiling never blocks manual render, approval or export |
| [tests/studio-hosted.test.ts:350](../source/tests/studio-hosted.test.ts#L350) | test | analysis admission rejects an active upload atomically while its completion probe retains ownership |
| [tests/studio-hosted.test.ts:368](../source/tests/studio-hosted.test.ts#L368) | test | owner settings validate exact fields, preserve usage and apply budget/storage caps without deleting originals |
| [tests/studio-hosted.test.ts:390](../source/tests/studio-hosted.test.ts#L390) | test | settings CAS and upload admission serialize against current limits; active work prevents policy changes |
| [tests/studio-native-flow.test.ts:31](../source/tests/studio-native-flow.test.ts#L31) | test | <dynamic test name> |
| [tests/studio-native-ui.test.ts:77](../source/tests/studio-native-ui.test.ts#L77) | test | Space Prepare starts new B while ordinary campaign opening keeps saved A and its unsaved draft |
| [tests/studio-native-ui.test.ts:93](../source/tests/studio-native-ui.test.ts#L93) | test | planner opens without selection and one library action proposes literal ready copy without Agents |
| [tests/studio-native-ui.test.ts:102](../source/tests/studio-native-ui.test.ts#L102) | test | explicit Space selection overrides empty or old new-draft candidates while keeping copy and consent |
| [tests/studio-native-ui.test.ts:122](../source/tests/studio-native-ui.test.ts#L122) | test | library preparation preserves restored copy, selected sources, ranges and consent |
| [tests/studio-native-ui.test.ts:131](../source/tests/studio-native-ui.test.ts#L131) | test | unsaved manual recipe and active operations block library preparation even if its handler is invoked |
| [tests/studio-native-ui.test.ts:138](../source/tests/studio-native-ui.test.ts#L138) | test | classification uses selected IDs and CAS; failed revision keeps selection and source state |
| [tests/studio-native-ui.test.ts:151](../source/tests/studio-native-ui.test.ts#L151) | test | automatic upload classification is default and manual category remains selectable in both languages |
| [tests/studio-planner.test.ts:27](../source/tests/studio-planner.test.ts#L27) | test | planner is deterministic and proposes one human-marked cooking background without mutating inputs |
| [tests/studio-planner.test.ts:39](../source/tests/studio-planner.test.ts#L39) | test | bounded alternatives and integer allocation reserve two seconds for each later segment |
| [tests/studio-planner.test.ts:50](../source/tests/studio-planner.test.ts#L50) | test | human speech locks preserve exact ranges/order and overfull locks abstain |
| [tests/studio-planner.test.ts:61](../source/tests/studio-planner.test.ts#L61) | test | unconfirmed speech and unclassified raw video are never auto-cut while keeping audio |
| [tests/studio-planner.test.ts:69](../source/tests/studio-planner.test.ts#L69) | test | muted background requires explicit consent even when speech was not detected |
| [tests/studio-planner.test.ts:74](../source/tests/studio-planner.test.ts#L74) | test | ready status, product scope, rights and explicit license review are server-side eligibility |
| [tests/studio-planner.test.ts:88](../source/tests/studio-planner.test.ts#L88) | test | reuse uses original SHA and interval across duplicate entries and historical deleted variants |
| [tests/studio-planner.test.ts:100](../source/tests/studio-planner.test.ts#L100) | test | overlapping copies cannot silently loop within a single recipe |
| [tests/studio-planner.test.ts:107](../source/tests/studio-planner.test.ts#L107) | test | planner does not develop vague ideas and preserves ready text literally |
| [tests/studio-planner.test.ts:121](../source/tests/studio-planner.test.ts#L121) | test | readability rejects valid-length copy that cannot be read in its time slot |
| [tests/studio-planner.test.ts:128](../source/tests/studio-planner.test.ts#L128) | test | client provenance is ignored; only trusted current-revision plan may be persisted |
| [tests/studio-planner.test.ts:137](../source/tests/studio-planner.test.ts#L137) | test | human classification changes invalidate planned rendering even without contentVersion changes |
| [tests/studio-planner.test.ts:148](../source/tests/studio-planner.test.ts#L148) | test | manual edits retain trusted provenance and fresh historical reuse still blocks effects |
| [tests/studio-planner.test.ts:157](../source/tests/studio-planner.test.ts#L157) | test | invalid pools and incompatible locks fail with bounded domain errors |
| [tests/studio-planner.test.ts:164](../source/tests/studio-planner.test.ts#L164) | test | replanning an existing variant refreshes replaced originals and invalidates its old approval |
| [tests/studio-planner.test.ts:181](../source/tests/studio-planner.test.ts#L181) | test | explicit narration replaces unknown source audio but must cover the full recipe |
| [tests/studio-planner.test.ts:192](../source/tests/studio-planner.test.ts#L192) | test | used intervals leave deterministic unused windows without copying unrelated history into provenance |
| [tests/studio-planner.test.ts:204](../source/tests/studio-planner.test.ts#L204) | test | optional analysis references are bounded provenance and do not silently change cuts or human speech |
| [tests/studio-planner.test.ts:216](../source/tests/studio-planner.test.ts#L216) | test | native preparation chooses stable allowed material and literal ready text without changing its inputs |
| [tests/studio-planner.test.ts:228](../source/tests/studio-planner.test.ts#L228) | test | preparation preserves explicit source order and all entered copy, duration, framing and consent |
| [tests/studio-planner.test.ts:236](../source/tests/studio-planner.test.ts#L236) | test | preparation abstains on ambiguous text and never truncates long product facts or develops an idea |
| [tests/studio-planner.test.ts:251](../source/tests/studio-planner.test.ts#L251) | test | automatic preparation never grants rights, shared scope or B-roll eligibility to generic video |
| [tests/studio-planner.test.ts:266](../source/tests/studio-planner.test.ts#L266) | test | preparation retains manually locked talking ranges and bounds automatic candidates at fifty |
| [tests/studio-processor.test.ts:29](../source/tests/studio-processor.test.ts#L29) | test | hosted runner probes originals, renders and streams the actual reusable FFmpeg output |
| [tests/studio-processor.test.ts:134](../source/tests/studio-processor.test.ts#L134) | test | DO account deletion waits for work, clears queue and permanently blocks new work after eviction |
| [tests/studio-processor.test.ts:149](../source/tests/studio-processor.test.ts#L149) | test | DO fails closed when the lifecycle store is unavailable before starting any container |
| [tests/studio-processor.test.ts:154](../source/tests/studio-processor.test.ts#L154) | test | DO never starts an R2 write when a delayed container read resolves after timeout and account stop |
| [tests/studio-processor.test.ts:174](../source/tests/studio-processor.test.ts#L174) | test | DO durably deduplicates jobs, retains queue during work and does not repeat failed work |
| [tests/studio-processor.test.ts:183](../source/tests/studio-processor.test.ts#L183) | test | DO preserves infrastructure failures through one watchdog and parks until an explicit same-ID request |
| [tests/studio-processor.test.ts:194](../source/tests/studio-processor.test.ts#L194) | test | DO serializes native operations, destroys scratch after each and rejects arbitrary object keys |
| [tests/studio-processor.test.ts:204](../source/tests/studio-processor.test.ts#L204) | test | DO stops failed container work and leaves the next explicit operation usable |
| [tests/studio-processor.test.ts:213](../source/tests/studio-processor.test.ts#L213) | test | DO streams exact bounded MP4 and cover bytes into private R2 without a media buffer |
| [tests/studio-processor.test.ts:239](../source/tests/studio-processor.test.ts#L239) | test | DO aggregate deadline includes startup and destroys the entire container |
| [tests/studio-processor.test.ts:249](../source/tests/studio-processor.test.ts#L249) | test | DO diagnostic logs identify fixed failing stage and exit code without exposing process output |
| [tests/studio-processor.test.ts:266](../source/tests/studio-processor.test.ts#L266) | test | DO accepts font bytes without Content-Length and preserves them while rejecting oversized or HTML assets |
| [tests/studio-render.test.ts:35](../source/tests/studio-render.test.ts#L35) | test | native FFprobe and FFmpeg process bounded synthetic sources and deterministic editable recipes |
| [tests/studio-render.test.ts:44](../source/tests/studio-render.test.ts#L44) | t.test | metadata describes actual tracks, dimensions and duration without a semantic classification |
| [tests/studio-render.test.ts:70](../source/tests/studio-render.test.ts#L70) | t.test | mixed video/image montage has exact duration, real cover, original custody and source audio control |
| [tests/studio-render.test.ts:86](../source/tests/studio-render.test.ts#L86) | t.test | all five template types produce decodable output; mute and selected narration remain distinct |
| [tests/studio-render.test.ts:108](../source/tests/studio-render.test.ts#L108) | t.test | reject invalid ranges, unreadable text, remote input, unsupported content and missing tools before success |
| [tests/studio-vite.test.ts:24](../source/tests/studio-vite.test.ts#L24) | test | isolated real Vite HTTP boundary assembles three fictional campaigns, exports, and serializes product protection |
| [tests/studio-vite.test.ts:62](../source/tests/studio-vite.test.ts#L62) | t.test | real multipart route bridge uploads a photo and prepares all three account-free examples |
| [tests/studio-vite.test.ts:123](../source/tests/studio-vite.test.ts#L123) | t.test | serialized legacy deletion and studio creation cannot leave an orphan product |
| [tests/studio-vite.test.ts:139](../source/tests/studio-vite.test.ts#L139) | t.test | HTTP parsing, origin and private-file denials keep prior state intact |
| [tests/studio-watch.test.ts:8](../source/tests/studio-watch.test.ts#L8) | test | actual Vite watcher observes source changes but excludes transient private media |
| [tests/studio.test.ts:27](../source/tests/studio.test.ts#L27) | test | capture accepts an unassigned incomplete idea and separates audio from speech |
| [tests/studio.test.ts:39](../source/tests/studio.test.ts#L39) | test | campaign preparation needs a real product but no social account, sources or complete objective |
| [tests/studio.test.ts:48](../source/tests/studio.test.ts#L48) | test | recipes preserve exact source versions and labels remain editable after reuse |
| [tests/studio.test.ts:61](../source/tests/studio.test.ts#L61) | test | changing source content versions does not rewrite an existing recipe |
| [tests/studio.test.ts:75](../source/tests/studio.test.ts#L75) | test | video approval requires a trusted exact-revision render and invalidates on editing |
| [tests/studio.test.ts:94](../source/tests/studio.test.ts#L94) | test | unknown rights, undeveloped ideas and absent manual copy cannot be approved |
| [tests/studio.test.ts:105](../source/tests/studio.test.ts#L105) | test | render specs preserve explicit ranges and do not treat silence as semantic classification |
| [tests/studio.test.ts:116](../source/tests/studio.test.ts#L116) | test | invalid ranges, excessive clips, unsupported originals and injected enums fail closed |
| [tests/studio.test.ts:131](../source/tests/studio.test.ts#L131) | test | old recipes retain their original file even if the material is replaced by a different type |
| [tests/studio.test.ts:144](../source/tests/studio.test.ts#L144) | test | rights revocation removes approval and export access without changing saved source bytes |
| [tests/studio.test.ts:154](../source/tests/studio.test.ts#L154) | test | narrated demo requires confirmed voice or a sufficiently long uploaded narration |
| [tests/studio.test.ts:167](../source/tests/studio.test.ts#L167) | test | asset registration is immutable, malformed requests do not mutate previous state |
| [tests/studio.test.ts:177](../source/tests/studio.test.ts#L177) | test | legacy import captures trusted immutable source provenance, including original spacing |
| [tests/studio.test.ts:198](../source/tests/studio.test.ts#L198) | test | replacement rights cannot authorize a restricted historical original |
| [tests/studio.test.ts:213](../source/tests/studio.test.ts#L213) | test | an owned historical original remains intentional while current revocation still prevents export |
| [tests/turnstile-ui.test.ts:31](../source/tests/turnstile-ui.test.ts#L31) | test | required widget loads only canonical explicit script and carries the endpoint action |
| [tests/turnstile-ui.test.ts:37](../source/tests/turnstile-ui.test.ts#L37) | test | expiry, provider error and interactive timeout invalidate the callback token |
| [tests/turnstile-ui.test.ts:42](../source/tests/turnstile-ui.test.ts#L42) | test | attempt reset, endpoint switch and unmount do not reuse the prior widget token |
| [tests/turnstile-ui.test.ts:51](../source/tests/turnstile-ui.test.ts#L51) | test | disabled and partially configured descriptors never create a usable token |
| [tests/turnstile-ui.test.ts:55](../source/tests/turnstile-ui.test.ts#L55) | test | script failure clears readiness and removes the failed script |
| [tests/ui-help.test.ts:20](../source/tests/ui-help.test.ts#L20) | test | every workflow has concise bilingual steps with a real PNG in both languages |
| [tests/ui-help.test.ts:40](../source/tests/ui-help.test.ts#L40) | test | every contextual entry renders its own first illustrated step and accessible navigation |
| [tests/ui-help.test.ts:62](../source/tests/ui-help.test.ts#L62) | test | Profile opens its contextual guide and Help remains inside each legacy editor |
