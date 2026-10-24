# Module and symbol index

The TypeScript 5.9.3 parser indexed 62 tracked TS/TSX/JS/MJS modules, 10530 declaration/field records, 278 import/re-export records and 9427 syntactic call/new-expression sites. Declaration files include generated platform type contracts and dominate raw symbol counts.

[Complete AST index](../inventories/ast-index.json) contains every indexed declaration, signature, declared field/type, import and call site with source location. Source function bodies, initializer values and call argument values are excluded. The index does not resolve symbols or execute modules.

## All indexed modules

| Module | Symbols/fields | Imports/re-exports | Call/new sites |
| --- | --- | --- | --- |
| `processor/runner.mjs` | 40 | 6 | 75 |
| `server/api.ts` | 20 | 1 | 39 |
| `server/d1.ts` | 11 | 2 | 22 |
| `server/entry.ts` | 0 | 2 | 0 |
| `server/local.ts` | 11 | 4 | 18 |
| `server/native-auth-store.js` | 21 | 0 | 67 |
| `server/native-auth.d.ts` | 4 | 0 | 0 |
| `server/native-auth.js` | 73 | 1 | 191 |
| `server/studio-analysis.ts` | 52 | 6 | 84 |
| `server/studio-hosted.ts` | 396 | 6 | 688 |
| `server/studio-local.ts` | 323 | 14 | 620 |
| `server/studio-processor.ts` | 122 | 8 | 204 |
| `server/studio-render.ts` | 159 | 3 | 205 |
| `server/supabase.ts` | 21 | 3 | 18 |
| `server/worker.ts` | 23 | 6 | 61 |
| `src/App.tsx` | 24 | 7 | 39 |
| `src/console/Console.tsx` | 142 | 6 | 441 |
| `src/console/EnvironmentSettings.tsx` | 20 | 2 | 20 |
| `src/console/Help.tsx` | 36 | 3 | 23 |
| `src/console/Settings.tsx` | 39 | 5 | 139 |
| `src/console/Studio.tsx` | 179 | 8 | 656 |
| `src/console/StudioAnalysis.tsx` | 67 | 4 | 141 |
| `src/console/StudioPlanner.tsx` | 68 | 5 | 256 |
| `src/console/TextSimulation.tsx` | 30 | 5 | 105 |
| `src/core/client.ts` | 9 | 1 | 12 |
| `src/core/domain.ts` | 105 | 0 | 159 |
| `src/core/generation.ts` | 83 | 1 | 99 |
| `src/core/settings.ts` | 32 | 1 | 9 |
| `src/core/studio-analysis.ts` | 32 | 0 | 34 |
| `src/core/studio-planner.ts` | 167 | 3 | 243 |
| `src/core/studio.ts` | 227 | 4 | 232 |
| `src/decoration/Background.tsx` | 46 | 5 | 69 |
| `src/decoration/assets.ts` | 29 | 0 | 37 |
| `src/decoration/registry.ts` | 12 | 3 | 3 |
| `src/decoration/renderer.ts` | 95 | 0 | 156 |
| `src/decoration/scenes.ts` | 117 | 1 | 360 |
| `src/decoration/scheduler.ts` | 33 | 0 | 27 |
| `src/i18n.tsx` | 18 | 1 | 13 |
| `src/main.tsx` | 0 | 7 | 3 |
| `tests/access-help.test.ts` | 40 | 5 | 170 |
| `tests/assets.test.ts` | 22 | 3 | 86 |
| `tests/d1-hosted.test.ts` | 43 | 7 | 124 |
| `tests/editorial.test.ts` | 34 | 8 | 151 |
| `tests/generation.test.ts` | 50 | 4 | 144 |
| `tests/hosted.test.ts` | 8 | 3 | 46 |
| `tests/motion.test.ts` | 31 | 4 | 122 |
| `tests/native-auth.test.ts` | 93 | 5 | 282 |
| `tests/scheduler.test.ts` | 29 | 3 | 83 |
| `tests/studio-analysis.test.ts` | 20 | 10 | 113 |
| `tests/studio-api.test.ts` | 116 | 11 | 437 |
| `tests/studio-hosted.test.ts` | 232 | 12 | 767 |
| `tests/studio-planner.test.ts` | 59 | 7 | 188 |
| `tests/studio-processor.test.ts` | 103 | 9 | 296 |
| `tests/studio-render.test.ts` | 34 | 9 | 194 |
| `tests/studio-vite.test.ts` | 61 | 10 | 177 |
| `tests/studio-watch.test.ts` | 11 | 6 | 73 |
| `tests/studio.test.ts` | 40 | 5 | 231 |
| `tests/ui-help.test.ts` | 20 | 6 | 71 |
| `tools/prepare-processor.mjs` | 0 | 2 | 11 |
| `tools/verify-assets.mjs` | 4 | 3 | 19 |
| `vite.config.ts` | 32 | 10 | 74 |
| `worker-configuration.d.ts` | 6562 | 2 | 0 |

## Product callable and type surface

The compact human reference below lists callable/type declarations in product modules. The JSON also contains local variable and nested field declarations, tests and generated platform typings. `inferred` means the source omits an annotation; no type checker inference is claimed. Optional/default parameters show `?` without publishing the default value. An exported binding is syntactic metadata, not proof of public runtime exposure.

### processor/runner.mjs

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `processor/runner.mjs:L11` | `<module>` | FunctionDeclaration | `fail(code: inferred): inferred` |
| `processor/runner.mjs:L12` | `<module>` | FunctionDeclaration | `inputPath(root: inferred, index: inferred): inferred` |
| `processor/runner.mjs:L16` | `<module>` | FunctionDeclaration | `fileInfo(path: inferred, maximum: inferred): inferred` |
| `processor/runner.mjs:L23` | `<module>` | FunctionDeclaration | `runAction(action: inferred, payload: inferred, options?: inferred): inferred` |
| `processor/runner.mjs:L65` | `<module>` | FunctionDeclaration | `main(): inferred` |

### server/api.ts

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `server/api.ts:L7` | `<module>` | InterfaceDeclaration | `Repository` |
| `server/api.ts:L8` | `Repository` | MethodSignature | `read(): Promise<Workspace>` |
| `server/api.ts:L9` | `Repository` | MethodSignature | `save(state: Workspace, expectedRevision: number): Promise<void>` |
| `server/api.ts:L16` | `<module>` | FunctionDeclaration | `json(value: unknown, status?: inferred): Response` |
| `server/api.ts:L19` | `<module>` | FunctionDeclaration | `readJson(request: Request, limit?: inferred): Promise<unknown>` |
| `server/api.ts:L56` | `<module>` | FunctionDeclaration | `editorialApi(request: Request, repository: Repository): Promise<Response>` |

### server/d1.ts

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `server/d1.ts:L3` | `<module>` | ClassDeclaration | `D1Repository` |
| `server/d1.ts:L6` | `D1Repository` | Constructor | `constructor(db: D1Database, studio?: inferred): inferred` |
| `server/d1.ts:L7` | `D1Repository` | MethodDeclaration | `read(): Promise<Workspace>` |
| `server/d1.ts:L11` | `D1Repository` | MethodDeclaration | `save(state: Workspace, expectedRevision: number): Promise<void>` |

### server/local.ts

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `server/local.ts:L11` | `<module>` | ClassDeclaration | `LocalRepository` |
| `server/local.ts:L14` | `LocalRepository` | Constructor | `constructor(path: string): inferred` |
| `server/local.ts:L17` | `LocalRepository` | MethodDeclaration | `read(): Promise<Workspace>` |
| `server/local.ts:L35` | `LocalRepository` | MethodDeclaration | `save(state: Workspace, expectedRevision: number): Promise<void>` |
| `server/local.ts:L36` | `LocalRepository.save` | FunctionVariable | `write(): inferred` |

### server/native-auth-store.js

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `server/native-auth-store.js:L3` | `<module>` | FunctionDeclaration | `batch(db: inferred, statements: inferred): inferred` |
| `server/native-auth-store.js:L8` | `<module>` | FunctionDeclaration | `cleanup(db: inferred, now: inferred): inferred` |
| `server/native-auth-store.js:L16` | `<module>` | FunctionDeclaration | `reserveChallenge(db: inferred, { challengeHash, ownerHash, codeHash, now, globalKey, dayKey, ipKey, ownerKey, known }: inferred): inferred` |
| `server/native-auth-store.js:L68` | `<module>` | FunctionDeclaration | `reserveHelp(db: inferred, { ticket, now, globalKey, dayKey, ipKey, ownerKey, known }: inferred): inferred` |
| `server/native-auth-store.js:L107` | `<module>` | FunctionDeclaration | `challengeOwner(db: inferred, hash: inferred): inferred` |
| `server/native-auth-store.js:L112` | `<module>` | FunctionDeclaration | `consumeChallenge(db: inferred, { challengeHash, codeHash, sessionHash, ownerHashes, now }: inferred): inferred` |
| `server/native-auth-store.js:L130` | `<module>` | FunctionDeclaration | `touchSession(db: inferred, hash: inferred, ownerHashes: inferred, now: inferred): inferred` |
| `server/native-auth-store.js:L137` | `<module>` | FunctionDeclaration | `revokeAuth(db: inferred, session: inferred, challenge: inferred): inferred` |
| `server/native-auth-store.js:L144` | `<module>` | FunctionDeclaration | `purgeAuth(db: inferred, now: inferred): inferred` |

### server/native-auth.js

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `server/native-auth.js:L18` | `<module>` | FunctionDeclaration | `accessInstructions(language: inferred, origin: inferred): inferred` |
| `server/native-auth.js:L42` | `<module>` | FunctionDeclaration | `response(value: inferred, status?: inferred, cookies?: inferred): inferred` |
| `server/native-auth.js:L49` | `<module>` | FunctionDeclaration | `cookie(name: inferred, value: inferred, seconds: inferred): inferred` |
| `server/native-auth.js:L52` | `<module>` | FunctionDeclaration | `tokenCookie(request: inferred, name: inferred): inferred` |
| `server/native-auth.js:L59` | `<module>` | FunctionDeclaration | `randomToken(): inferred` |
| `server/native-auth.js:L63` | `<module>` | FunctionDeclaration | `randomCode(): inferred` |
| `server/native-auth.js:L69` | `<module>` | FunctionDeclaration | `configuration(env: inferred): inferred` |
| `server/native-auth.js:L80` | `configuration` | FunctionVariable | `hash(value: inferred): inferred` |
| `server/native-auth.js:L86` | `<module>` | FunctionDeclaration | `body(request: inferred): inferred` |
| `server/native-auth.js:L118` | `<module>` | FunctionDeclaration | `authorizedOwner(request: inferred, env: inferred): inferred` |
| `server/native-auth.js:L128` | `<module>` | FunctionDeclaration | `handleOwnerAuth(request: inferred, env: inferred, ctx: inferred): inferred` |
| `server/native-auth.js:L214` | `<module>` | FunctionDeclaration | `purgeOwnerAuth(env: inferred): inferred` |

### server/studio-analysis.ts

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `server/studio-analysis.ts:L11` | `<module>` | TypeAliasDeclaration | `AnalyzedMedia = { analysis: StudioAnalysisResult; thumbnails: Array<{ name: string; path: string; size: number; mime: "image/jpeg" }>; }` |
| `server/studio-analysis.ts:L17` | `<module>` | FunctionDeclaration | `parseTechnicalSignals(text: string, range: StudioAnalysisRange): { intervals: StudioAnalysisInterval[]; truncated: boolean }` |
| `server/studio-analysis.ts:L19` | `parseTechnicalSignals` | FunctionVariable | `point(relative: number): inferred` |
| `server/studio-analysis.ts:L21` | `parseTechnicalSignals` | FunctionVariable | `add(kind: StudioAnalysisInterval["kind"], start: number, end: number): inferred` |
| `server/studio-analysis.ts:L43` | `<module>` | FunctionDeclaration | `analyzeMedia(path: string, suppliedRange: StudioAnalysisRange, outputDir: string, tools: MediaTools, options?: { expectedToolVersion?: string }): Promise<AnalyzedMedia>` |
| `server/studio-analysis.ts:L46` | `analyzeMedia` | FunctionVariable | `remaining(maximum: number): inferred` |
| `server/studio-analysis.ts:L58` | `analyzeMedia` | FunctionVariable | `unavailable(message: string): AnalyzedMedia` |
| `server/studio-analysis.ts:L75` | `analyzeMedia` | FunctionVariable | `addSignals(output: string): inferred` |

### server/studio-hosted.ts

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `server/studio-hosted.ts:L14` | `<module>` | TypeAliasDeclaration | `HostedStudioEnv = Pick<Env, "DB" \| "MEDIA" \| "MARKER_ORIGIN" \| "STUDIO_PROCESSOR">` |
| `server/studio-hosted.ts:L15` | `<module>` | TypeAliasDeclaration | `HostedMediaMetadata = { kind: "video" \| "image" \| "audio"; mime: string; duration: number \| null; width: number \| null; height: number \| null; audioTrack: "present" \| "absent" \| "unknown"; processing: "ready" \| "unsupported"; sha256: string; }` |
| `server/studio-hosted.ts:L20` | `<module>` | InterfaceDeclaration | `StudioProcessor` |
| `server/studio-hosted.ts:L21` | `StudioProcessor` | MethodSignature | `probe(key: string, mimeHint?: string): Promise<HostedMediaMetadata>` |
| `server/studio-hosted.ts:L22` | `StudioProcessor` | MethodSignature | `enqueue(jobId: string): Promise<void>` |
| `server/studio-hosted.ts:L23` | `StudioProcessor` | MethodSignature | `render(jobId: string, spec: StudioRenderSpec, inputs: Array<{ assetId: string; key: string }>, outputs: { videoKey: string; coverKey: string }): Promise<{ duration: number; width: number; height: number }>` |
| `server/studio-hosted.ts:L25` | `StudioProcessor` | MethodSignature | `analyze(analysisId: string, key: string, range: StudioAnalysisRange, expectedToolVersion: string): Promise<{ analysis: StudioAnalysisResult; thumbnails: Array<{ name: string; size: number }> }>` |
| `server/studio-hosted.ts:L32` | `<module>` | TypeAliasDeclaration | `HostedAnalysis = { id: string; assetId: string; sha256: string; range: StudioAnalysisRange; profile: typeof ANALYSIS_PROFILE; toolVersion: string; status: "queued" \| "running" \| "completed" \| "failed"; createdAt: string; updatedAt: string; result?: StudioAnalysisResult; thumbnails?: Array<{ name: string; size: number }>; error?: string; }` |
| `server/studio-hosted.ts:L38` | `<module>` | TypeAliasDeclaration | `Upload = { id: string; name: string; mime: string; size: number; offset: number; status: "uploading" \| "completed" \| "cancelled"; createdAt: string; assetId?: string; duplicateOf?: string; phase?: "uploading" \| "uploaded" \| "probing" \| "probe-failed"; multipartId: string; key: string; parts: R2UploadedPart[]; probe?: HostedMediaMetadata; }` |
| `server/studio-hosted.ts:L45` | `<module>` | TypeAliasDeclaration | `PublicJob = { id: string; variantId: string; recipeRevision: number; kind: "render" \| "text-approval"; status: "queued" \| "running" \| "completed" \| "failed"; createdAt: string; updatedAt: string; error?: string; errorCode?: string; width?: number; height?: number; duration?: number; }` |
| `server/studio-hosted.ts:L50` | `<module>` | TypeAliasDeclaration | `TextRecipe = { variantId: string; recipeRevision: number; template: "text"; platform: string; campaignId: string; hook: string; body: string; cta: string }` |
| `server/studio-hosted.ts:L51` | `<module>` | TypeAliasDeclaration | `JobReceipt = { recipe: StudioRenderSpec \| TextRecipe; sourceSnapshots: StudioSourceSnapshot[]; planner?: StudioState["variants"][number]["planner"] }` |
| `server/studio-hosted.ts:L52` | `<module>` | TypeAliasDeclaration | `Job = PublicJob & { videoKey?: string; coverKey?: string; bytes?: number; receipt: JobReceipt; inputs?: Array<{ assetId: string; key: string }> }` |
| `server/studio-hosted.ts:L53` | `<module>` | TypeAliasDeclaration | `Limits = { stored_bytes: number; reserved_bytes: number; compute_token: string \| null; compute_until: number }` |
| `server/studio-hosted.ts:L54` | `<module>` | ClassDeclaration | `ApiError` |
| `server/studio-hosted.ts:L56` | `ApiError` | Constructor | `constructor(message: string, status?: inferred, code?: inferred): inferred` |
| `server/studio-hosted.ts:L58` | `<module>` | FunctionDeclaration | `id(value: string): string` |
| `server/studio-hosted.ts:L59` | `<module>` | FunctionDeclaration | `integer(value: unknown, label: string): number` |
| `server/studio-hosted.ts:L62` | `<module>` | FunctionDeclaration | `fail(error: unknown): Response` |
| `server/studio-hosted.ts:L67` | `<module>` | FunctionDeclaration | `uploadPublic(value: Upload): inferred` |
| `server/studio-hosted.ts:L70` | `<module>` | FunctionDeclaration | `jobPublic(value: Job): inferred` |
| `server/studio-hosted.ts:L74` | `<module>` | FunctionDeclaration | `first<T>(env: HostedStudioEnv, sql: string, ...args: (string \| number \| null)[]): Promise<T \| null>` |
| `server/studio-hosted.ts:L77` | `<module>` | FunctionDeclaration | `all<T>(env: HostedStudioEnv, sql: string, ...args: (string \| number \| null)[]): Promise<T[]>` |
| `server/studio-hosted.ts:L80` | `<module>` | FunctionDeclaration | `readUpload(env: HostedStudioEnv, value: string): Promise<Upload>` |
| `server/studio-hosted.ts:L84` | `<module>` | FunctionDeclaration | `readJob(env: HostedStudioEnv, value: string): Promise<Job>` |
| `server/studio-hosted.ts:L88` | `<module>` | FunctionDeclaration | `readHostedStudio(env: HostedStudioEnv): Promise<StudioState>` |
| `server/studio-hosted.ts:L99` | `<module>` | FunctionDeclaration | `saveState(env: HostedStudioEnv, next: StudioState, previous: StudioState, workspaceRevision?: number, extra?: Array<(token: string) => D1PreparedStatement>): Promise<void>` |
| `server/studio-hosted.ts:L117` | `saveState` | FunctionVariable | `changed<T extends { id: string }>(current: T[], before: T[]): T[]` |
| `server/studio-hosted.ts:L133` | `<module>` | FunctionDeclaration | `assertProductUnused(env: HostedStudioEnv, productId: string): Promise<void>` |
| `server/studio-hosted.ts:L138` | `<module>` | FunctionDeclaration | `usage(env: HostedStudioEnv): inferred` |
| `server/studio-hosted.ts:L147` | `<module>` | FunctionDeclaration | `plannerHistory(env: HostedStudioEnv, state: StudioState): Promise<StudioPlannerUse[]>` |
| `server/studio-hosted.ts:L162` | `<module>` | FunctionDeclaration | `validateAnalysisReferences(env: HostedStudioEnv, state: StudioState, input: {analysisIds?:string[];candidateIds:string[];lockedSelections:Array<{materialId:string;start:number;end:number}>}): Promise<void>` |
| `server/studio-hosted.ts:L173` | `<module>` | FunctionDeclaration | `jobSummaries(env: HostedStudioEnv): inferred` |
| `server/studio-hosted.ts:L182` | `<module>` | FunctionDeclaration | `capabilities(env: HostedStudioEnv): inferred` |
| `server/studio-hosted.ts:L191` | `<module>` | FunctionDeclaration | `readSettings(env: HostedStudioEnv): Promise<StudioSettings>` |
| `server/studio-hosted.ts:L198` | `<module>` | FunctionDeclaration | `settingsResponse(env: HostedStudioEnv): Promise<StudioSettingsResponse>` |
| `server/studio-hosted.ts:L203` | `<module>` | FunctionDeclaration | `saveSettings(request: Request, env: HostedStudioEnv): Promise<Response>` |
| `server/studio-hosted.ts:L219` | `<module>` | FunctionDeclaration | `claimCompute(env: HostedStudioEnv, token: string, cents: number, reserve?: inferred, admission?: { revision: number; job?: Job; analysis?: HostedAnalysis; stateBytes?: number }): Promise<void>` |
| `server/studio-hosted.ts:L254` | `<module>` | FunctionDeclaration | `releaseCompute(env: HostedStudioEnv, token: string, reserved?: inferred, stored?: inferred): inferred` |
| `server/studio-hosted.ts:L258` | `<module>` | FunctionDeclaration | `releaseJobResources(env: HostedStudioEnv, jobId: string, stored?: inferred, analysis?: inferred): inferred` |
| `server/studio-hosted.ts:L269` | `<module>` | FunctionDeclaration | `publicAnalysis(value: HostedAnalysis): inferred` |
| `server/studio-hosted.ts:L272` | `<module>` | FunctionDeclaration | `analysisBytes(env: HostedStudioEnv, analysisId: string): Promise<number>` |
| `server/studio-hosted.ts:L276` | `<module>` | FunctionDeclaration | `queueAnalysis(request: Request, env: HostedStudioEnv): Promise<Response>` |
| `server/studio-hosted.ts:L295` | `<module>` | FunctionDeclaration | `executeHostedAnalysis(env: HostedStudioEnv, original: HostedAnalysis, processor: StudioProcessor): Promise<void>` |
| `server/studio-hosted.ts:L328` | `<module>` | FunctionDeclaration | `checkRevision(body: Record<string, unknown>, state: StudioState): inferred` |
| `server/studio-hosted.ts:L331` | `<module>` | FunctionDeclaration | `createUpload(request: Request, env: HostedStudioEnv): Promise<Response>` |
| `server/studio-hosted.ts:L353` | `<module>` | FunctionDeclaration | `lockUpload(env: HostedStudioEnv, value: Upload): Promise<string>` |
| `server/studio-hosted.ts:L360` | `<module>` | FunctionDeclaration | `saveUpload(env: HostedStudioEnv, value: Upload, token: string): Promise<void>` |
| `server/studio-hosted.ts:L365` | `<module>` | FunctionDeclaration | `appendChunk(request: Request, env: HostedStudioEnv, value: Upload): Promise<Response>` |
| `server/studio-hosted.ts:L394` | `<module>` | FunctionDeclaration | `completeUpload(env: HostedStudioEnv, value: Upload): Promise<Response>` |
| `server/studio-hosted.ts:L443` | `<module>` | FunctionDeclaration | `mediaResponse(request: Request, env: HostedStudioEnv, key: string, mime: string, download?: string): Promise<Response>` |
| `server/studio-hosted.ts:L460` | `<module>` | FunctionDeclaration | `queueRender(env: HostedStudioEnv, state: StudioState, variantId: string, request: Request, workspace: Workspace): Promise<Response>` |
| `server/studio-hosted.ts:L489` | `<module>` | FunctionDeclaration | `executeHostedRender(env: HostedStudioEnv, jobId: string, processor: StudioProcessor): Promise<void>` |
| `server/studio-hosted.ts:L540` | `<module>` | FunctionDeclaration | `route(request: Request, env: HostedStudioEnv, workspace: Workspace): Promise<Response \| null>` |
| `server/studio-hosted.ts:L677` | `<module>` | FunctionDeclaration | `hostedStudioApi(request: Request, env: HostedStudioEnv, workspace: Workspace): Promise<Response \| null>` |

### server/studio-local.ts

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `server/studio-local.ts:L27` | `<module>` | TypeAliasDeclaration | `LocalAnalysis = { id: string; assetId: string; sha256: string; range: StudioAnalysisRange; profile: typeof ANALYSIS_PROFILE; toolVersion: string; status: "queued" \| "running" \| "completed" \| "failed"; createdAt: string; updatedAt: string; result?: StudioAnalysisResult; thumbnails?: Array<{name:string;size:number}>; error?: string; }` |
| `server/studio-local.ts:L32` | `<module>` | TypeAliasDeclaration | `Upload = { id: string; name: string; mime: string; size: number; offset: number; status: "uploading" \| "completed" \| "cancelled"; createdAt: string; assetId?: string; duplicateOf?: string; }` |
| `server/studio-local.ts:L37` | `<module>` | TypeAliasDeclaration | `StudioJob = { id: string; variantId: string; recipeRevision: number; status: "queued" \| "running" \| "completed" \| "failed"; createdAt: string; updatedAt: string; error?: string; errorCode?: string; width?: number; height?: number; duration?: number; kind?: "render" \| "text-approval"; provenance?: "recorded" \| "unknown"; sourceRefs?: Array<{ materialId: string; contentVersion: number; assetId?: string; kind: StudioSourceSnapshot["kind"] }>; }` |
| `server/studio-local.ts:L46` | `<module>` | TypeAliasDeclaration | `TextRecipe = { variantId: string; recipeRevision: number; template: "text"; platform: string; campaignId: string; hook: string; body: string; cta: string }` |
| `server/studio-local.ts:L47` | `<module>` | TypeAliasDeclaration | `JobReceipt = { recipe: ReturnType<typeof buildRenderSpec> \| TextRecipe; sourceSnapshots: StudioSourceSnapshot[]; planner?: StudioState["variants"][number]["planner"] }` |
| `server/studio-local.ts:L48` | `<module>` | TypeAliasDeclaration | `StoredJob = StudioJob & { videoKey?: string; coverKey?: string; receipt?: JobReceipt }` |
| `server/studio-local.ts:L49` | `<module>` | TypeAliasDeclaration | `StudioApiOptions = { directory: string; tools: MediaTools }` |
| `server/studio-local.ts:L51` | `<module>` | ClassDeclaration | `ApiError` |
| `server/studio-local.ts:L54` | `ApiError` | Constructor | `constructor(message: string, status?: inferred, code?: inferred): inferred` |
| `server/studio-local.ts:L58` | `<module>` | FunctionDeclaration | `requiredId(value: string): string` |
| `server/studio-local.ts:L62` | `<module>` | FunctionDeclaration | `integer(value: unknown, label: string): number` |
| `server/studio-local.ts:L67` | `<module>` | FunctionDeclaration | `safeName(value: unknown): string` |
| `server/studio-local.ts:L72` | `<module>` | FunctionDeclaration | `mediaMime(value: unknown, name: string): string` |
| `server/studio-local.ts:L87` | `<module>` | FunctionDeclaration | `publicJob(job: StoredJob): StudioJob` |
| `server/studio-local.ts:L91` | `<module>` | FunctionDeclaration | `failure(error: unknown): Response` |
| `server/studio-local.ts:L99` | `<module>` | FunctionDeclaration | `createStudioApi(options: StudioApiOptions): inferred` |
| `server/studio-local.ts:L127` | `createStudioApi` | FunctionDeclaration | `serialize<T>(operation: () => Promise<T> \| T): Promise<T>` |
| `server/studio-local.ts:L135` | `createStudioApi` | FunctionDeclaration | `readState(): StudioState` |
| `server/studio-local.ts:L144` | `createStudioApi` | FunctionDeclaration | `saveState(state: StudioState, expectedRevision: number, assetFile?: { id: string; key: string }, completedUpload?: Upload, usageReceipt?: StoredJob): void` |
| `server/studio-local.ts:L172` | `createStudioApi` | FunctionDeclaration | `uploads(): Upload[]` |
| `server/studio-local.ts:L175` | `createStudioApi` | FunctionDeclaration | `upload(id: string): Upload` |
| `server/studio-local.ts:L180` | `createStudioApi` | FunctionDeclaration | `saveUpload(value: Upload): void` |
| `server/studio-local.ts:L183` | `createStudioApi` | FunctionDeclaration | `jobs(): StoredJob[]` |
| `server/studio-local.ts:L186` | `createStudioApi` | FunctionDeclaration | `jobSummaries(): StudioJob[]` |
| `server/studio-local.ts:L204` | `createStudioApi` | FunctionDeclaration | `materialUsage(state: StudioState): Record<string, number>` |
| `server/studio-local.ts:L206` | `createStudioApi.materialUsage` | FunctionVariable | `add(materialId: string, variantId: string): inferred` |
| `server/studio-local.ts:L217` | `createStudioApi` | FunctionDeclaration | `plannerHistory(state: StudioState): StudioPlannerUse[]` |
| `server/studio-local.ts:L232` | `createStudioApi` | FunctionDeclaration | `analysisMetadata(): number` |
| `server/studio-local.ts:L235` | `createStudioApi` | FunctionDeclaration | `validateAnalysisReferences(state: StudioState, input: {analysisIds?:string[];candidateIds:string[];lockedSelections:Array<{materialId:string;start:number;end:number}>}): void` |
| `server/studio-local.ts:L246` | `createStudioApi` | FunctionDeclaration | `analysisJobs(): LocalAnalysis[]` |
| `server/studio-local.ts:L249` | `createStudioApi` | FunctionDeclaration | `publicAnalysis(value: LocalAnalysis): inferred` |
| `server/studio-local.ts:L252` | `createStudioApi` | FunctionDeclaration | `storageUsage(state: StudioState): Promise<{storageBytes:number;reservedBytes:number}>` |
| `server/studio-local.ts:L261` | `createStudioApi` | FunctionDeclaration | `readSettings(): StudioSettings` |
| `server/studio-local.ts:L264` | `createStudioApi` | FunctionDeclaration | `settingsResponse(): Promise<StudioSettingsResponse>` |
| `server/studio-local.ts:L267` | `createStudioApi` | FunctionDeclaration | `saveSettings(request: Request): Promise<Response>` |
| `server/studio-local.ts:L278` | `createStudioApi` | FunctionDeclaration | `saveAnalysis(value: LocalAnalysis, finished?: inferred): void` |
| `server/studio-local.ts:L281` | `createStudioApi` | FunctionDeclaration | `executeAnalysis(entry: LocalAnalysis): Promise<void>` |
| `server/studio-local.ts:L294` | `createStudioApi` | FunctionDeclaration | `queueAnalysis(request: Request): Promise<Response>` |
| `server/studio-local.ts:L313` | `createStudioApi` | FunctionDeclaration | `job(id: string): StoredJob` |
| `server/studio-local.ts:L318` | `createStudioApi` | FunctionDeclaration | `saveJob(value: StoredJob): void` |
| `server/studio-local.ts:L330` | `createStudioApi` | FunctionDeclaration | `assetPath(id: string): string` |
| `server/studio-local.ts:L336` | `createStudioApi` | FunctionDeclaration | `checkRevision(body: Record<string, unknown>, state: StudioState): void` |
| `server/studio-local.ts:L340` | `createStudioApi` | FunctionDeclaration | `completeUpload(id: string): Promise<Response>` |
| `server/studio-local.ts:L380` | `createStudioApi` | FunctionDeclaration | `appendChunk(request: Request, id: string): Promise<Response>` |
| `server/studio-local.ts:L428` | `createStudioApi` | FunctionDeclaration | `mediaResponse(request: Request, path: string, mime: string, name?: string): Promise<Response>` |
| `server/studio-local.ts:L451` | `createStudioApi` | FunctionDeclaration | `executeRender(entry: StoredJob, spec: ReturnType<typeof buildRenderSpec>, paths: Record<string, string>): Promise<void>` |
| `server/studio-local.ts:L466` | `createStudioApi` | FunctionDeclaration | `jobPath(key: string): string` |
| `server/studio-local.ts:L472` | `createStudioApi` | FunctionDeclaration | `route(request: Request, workspace: Workspace): Promise<Response \| null>` |
| `server/studio-local.ts:L627` | `createStudioApi` | MethodDeclaration | `handle(request: Request, workspace: Workspace): Promise<Response \| null>` |
| `server/studio-local.ts:L631` | `createStudioApi` | MethodDeclaration | `close(): Promise<void>` |

### server/studio-processor.ts

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `server/studio-processor.ts:L16` | `<module>` | TypeAliasDeclaration | `Operation = { container: Container; deadline: number; stage: string; exitCode?: number; diagnostic?: string; live(): void }` |
| `server/studio-processor.ts:L16` | `<module>` | MethodSignature | `live(): void` |
| `server/studio-processor.ts:L17` | `<module>` | TypeAliasDeclaration | `RenderResult = { duration: number; width: number; height: number; videoSize: number; coverSize: number }` |
| `server/studio-processor.ts:L19` | `<module>` | FunctionDeclaration | `failure(code: string): Error` |
| `server/studio-processor.ts:L20` | `<module>` | FunctionDeclaration | `key(value: string): void` |
| `server/studio-processor.ts:L23` | `<module>` | FunctionDeclaration | `job(value: string): void` |
| `server/studio-processor.ts:L24` | `<module>` | FunctionDeclaration | `stream(text: string): ReadableStream` |
| `server/studio-processor.ts:L27` | `<module>` | ClassDeclaration | `StudioProcessor` |
| `server/studio-processor.ts:L31` | `StudioProcessor` | MethodDeclaration | `enqueue(jobId: string): Promise<void>` |
| `server/studio-processor.ts:L47` | `StudioProcessor` | MethodDeclaration | `alarm(): Promise<void>` |
| `server/studio-processor.ts:L75` | `StudioProcessor` | MethodDeclaration | `probe(objectKey: string, mimeHint?: string): Promise<MediaMetadata & { sha256: string }>` |
| `server/studio-processor.ts:L84` | `StudioProcessor` | MethodDeclaration | `render(jobId: string, spec: RenderSpec, inputs: Array<{ assetId: string; key: string }>, outputs: { videoKey: string; coverKey: string }): Promise<{ duration: number; width: number; height: number }>` |
| `server/studio-processor.ts:L99` | `StudioProcessor` | MethodDeclaration | `analyze(analysisId: string, objectKey: string, range: StudioAnalysisRange, expectedToolVersion: string): Promise<{analysis:StudioAnalysisResult;thumbnails:Array<{name:string;size:number}>}>` |
| `server/studio-processor.ts:L118` | `StudioProcessor` | MethodDeclaration | `exclusive<T>(phase: "probe" \| "render" \| "analysis", work: (operation: Operation) => Promise<T>): Promise<T>` |
| `server/studio-processor.ts:L123` | `StudioProcessor.exclusive` | MethodDeclaration | `live(): inferred` |
| `server/studio-processor.ts:L164` | `StudioProcessor` | MethodDeclaration | `command(operation: Operation, argv: string[], stdin?: ReadableStream, capture?: inferred): Promise<string>` |
| `server/studio-processor.ts:L175` | `StudioProcessor` | MethodDeclaration | `diagnosticOutput(source: ReadableStream): Promise<string \| undefined>` |
| `server/studio-processor.ts:L196` | `StudioProcessor` | MethodDeclaration | `smallOutput(source: ReadableStream, maximum?: inferred): Promise<string>` |
| `server/studio-processor.ts:L211` | `StudioProcessor` | MethodDeclaration | `write(operation: Operation, name: string, body: ReadableStream): Promise<void>` |
| `server/studio-processor.ts:L216` | `StudioProcessor` | MethodDeclaration | `bootstrap(operation: Operation): Promise<void>` |
| `server/studio-processor.ts:L232` | `StudioProcessor` | MethodDeclaration | `fontBytes(response: Response): Promise<Uint8Array<ArrayBuffer>>` |
| `server/studio-processor.ts:L253` | `StudioProcessor` | MethodDeclaration | `input(operation: Operation, objectKey: string, index: number): Promise<void>` |
| `server/studio-processor.ts:L261` | `StudioProcessor` | MethodDeclaration | `action(operation: Operation, action: "probe" \| "render" \| "analysis", payload: unknown): Promise<unknown>` |
| `server/studio-processor.ts:L269` | `StudioProcessor` | MethodDeclaration | `output(operation: Operation, name: string, objectKey: string, size: number, mime: string): Promise<void>` |

### server/studio-render.ts

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `server/studio-render.ts:L5` | `<module>` | InterfaceDeclaration | `MediaTools` |
| `server/studio-render.ts:L6` | `<module>` | InterfaceDeclaration | `RenderSpec` |
| `server/studio-render.ts:L21` | `<module>` | InterfaceDeclaration | `MediaMetadata` |
| `server/studio-render.ts:L30` | `<module>` | ClassDeclaration | `StudioMediaError` |
| `server/studio-render.ts:L33` | `StudioMediaError` | Constructor | `constructor(code: string, message: string, diagnostics?: string): inferred` |
| `server/studio-render.ts:L43` | `<module>` | TypeAliasDeclaration | `TemplatePreset = { x: number; y: number; width: number; height: number; fonts: [number, number, number]; hookEnd: number; ctaStart: number }` |
| `server/studio-render.ts:L52` | `<module>` | InterfaceDeclaration | `ProbeStream` |
| `server/studio-render.ts:L58` | `<module>` | InterfaceDeclaration | `ProbeResult` |
| `server/studio-render.ts:L60` | `<module>` | FunctionDeclaration | `fail(code: string, message: string): never` |
| `server/studio-render.ts:L61` | `<module>` | FunctionDeclaration | `finite(value: unknown): value is number` |
| `server/studio-render.ts:L62` | `<module>` | FunctionDeclaration | `number(value: unknown): number \| null` |
| `server/studio-render.ts:L66` | `<module>` | FunctionDeclaration | `localFile(path: string, maximum?: inferred): Promise<void>` |
| `server/studio-render.ts:L74` | `<module>` | FunctionDeclaration | `runTool(executable: string, args: string[], cwd: string \| undefined, timeout: number, captureLimit?: inferred): Promise<string>` |
| `server/studio-render.ts:L80` | `runTool` | FunctionVariable | `stop(error: StudioMediaError): inferred` |
| `server/studio-render.ts:L101` | `<module>` | FunctionDeclaration | `rawProbe(path: string, tools: MediaTools): Promise<ProbeResult>` |
| `server/studio-render.ts:L107` | `<module>` | FunctionDeclaration | `metadata(probe: ProbeResult, webm: boolean): MediaMetadata` |
| `server/studio-render.ts:L136` | `<module>` | FunctionDeclaration | `probeMedia(path: string, tools: MediaTools): Promise<MediaMetadata>` |
| `server/studio-render.ts:L150` | `<module>` | FunctionDeclaration | `validateSpec(spec: RenderSpec): void` |
| `server/studio-render.ts:L164` | `<module>` | FunctionDeclaration | `wrapText(text: string, columns: number): string[]` |
| `server/studio-render.ts:L183` | `<module>` | FunctionDeclaration | `textFilter(text: string, name: string, start: number, end: number, stage: string, preferredSize: number, preset: TemplatePreset): Promise<string>` |
| `server/studio-render.ts:L195` | `<module>` | FunctionDeclaration | `visualFilter(spec: RenderSpec): string` |
| `server/studio-render.ts:L202` | `<module>` | FunctionDeclaration | `fontFile(tools: MediaTools): Promise<string>` |
| `server/studio-render.ts:L209` | `<module>` | FunctionDeclaration | `renderMedia(spec: RenderSpec, assetPaths: Record<string, string>, outputDir: string, tools: MediaTools): Promise<{ videoPath: string; coverPath: string; width: number; height: number; duration: number }>` |

### server/supabase.ts

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `server/supabase.ts:L9` | `<module>` | TypeAliasDeclaration | `SupabaseConfig = { url: string; key: string; ownerId: string }` |
| `server/supabase.ts:L10` | `<module>` | FunctionDeclaration | `upstream(config: SupabaseConfig, path: string, token: string, body?: unknown): Promise<Response>` |
| `server/supabase.ts:L27` | `<module>` | FunctionDeclaration | `ownerIdentity(config: SupabaseConfig, token: string): Promise<boolean>` |
| `server/supabase.ts:L40` | `<module>` | FunctionDeclaration | `responseToRequest(response: Response): Request` |
| `server/supabase.ts:L53` | `<module>` | ClassDeclaration | `SupabaseRepository` |
| `server/supabase.ts:L56` | `SupabaseRepository` | Constructor | `constructor(config: SupabaseConfig, token: string): inferred` |
| `server/supabase.ts:L60` | `SupabaseRepository` | MethodDeclaration | `read(): Promise<Workspace>` |
| `server/supabase.ts:L75` | `SupabaseRepository` | MethodDeclaration | `save(state: Workspace, expectedRevision: number): Promise<void>` |

### server/worker.ts

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `server/worker.ts:L14` | `<module>` | FunctionVariable | `cookie(token?: inferred, seconds?: inferred): inferred` |
| `server/worker.ts:L16` | `<module>` | FunctionDeclaration | `hostedApi(request: Request, config: SupabaseConfig): Promise<Response>` |
| `server/worker.ts:L107` | `<module>` | MethodDeclaration | `scheduled(_event: inferred, env: inferred, ctx: inferred): inferred` |
| `server/worker.ts:L108` | `<module>` | MethodDeclaration | `fetch(request: inferred, env: inferred, ctx: inferred): inferred` |
| `server/worker.ts:L115` | `<module>` | FunctionDeclaration | `nativeApi(request: Request, env: Env, ctx: Pick<ExecutionContext, 'waitUntil'>): Promise<Response>` |

### src/App.tsx

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `src/App.tsx:L12` | `<module>` | FunctionDeclaration | `App(): inferred` |
| `src/App.tsx:L37` | `App` | FunctionDeclaration | `changeCache(accepted: boolean): inferred` |

### src/console/Console.tsx

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `src/console/Console.tsx:L36` | `<module>` | TypeAliasDeclaration | `Tab = "overview" \| "products" \| "accounts" \| "space" \| "campaigns" \| "queue" \| "settings"` |
| `src/console/Console.tsx:L38` | `<module>` | TypeAliasDeclaration | `Editor = \| { kind: "product"; item?: Product } \| { kind: "account"; item?: Account } \| { kind: "source"; item?: Source } \| { kind: "campaign" } \| { kind: "post"; item: Post }` |
| `src/console/Console.tsx:L53` | `<module>` | FunctionDeclaration | `sectionFromHash(): Tab` |
| `src/console/Console.tsx:L66` | `<module>` | FunctionVariable | `formatDate(value: string, language: string, timezone?: string): inferred` |
| `src/console/Console.tsx:L74` | `<module>` | FunctionDeclaration | `Empty({ children }: { children: ReactNode }): inferred` |
| `src/console/Console.tsx:L77` | `<module>` | FunctionDeclaration | `Badge({ value }: { value: string }): inferred` |
| `src/console/Console.tsx:L85` | `<module>` | FunctionDeclaration | `Field({ label, children, wide , }: { label: string; children: ReactNode; wide?: boolean; }): inferred` |
| `src/console/Console.tsx:L102` | `<module>` | FunctionDeclaration | `values(form: HTMLFormElement): Record<string, unknown>` |
| `src/console/Console.tsx:L106` | `<module>` | FunctionDeclaration | `Console({ onAccessChange, environment }: { onAccessChange?: (authenticated: boolean) => void; environment?: ReactNode }): inferred` |
| `src/console/Console.tsx:L108` | `Console` | FunctionVariable | `date(value: string, timezone?: string): inferred` |
| `src/console/Console.tsx:L137` | `Console` | FunctionVariable | `navigate(): inferred` |
| `src/console/Console.tsx:L145` | `Console` | FunctionDeclaration | `refresh(): inferred` |
| `src/console/Console.tsx:L169` | `Console` | FunctionDeclaration | `command(command: Command): Promise<boolean>` |
| `src/console/Console.tsx:L185` | `Console` | FunctionDeclaration | `login(event: FormEvent<HTMLFormElement>): inferred` |
| `src/console/Console.tsx:L210` | `Console` | FunctionDeclaration | `sendAccessHelp(event: FormEvent<HTMLFormElement>): inferred` |
| `src/console/Console.tsx:L226` | `Console` | FunctionDeclaration | `remove(type: string, id: string, description: string): inferred` |
| `src/console/Console.tsx:L234` | `Console` | FunctionDeclaration | `copy(post: Post): inferred` |
| `src/console/Console.tsx:L242` | `Console` | FunctionDeclaration | `closeAccountMenu(): inferred` |
| `src/console/Console.tsx:L245` | `Console` | FunctionDeclaration | `reload(): inferred` |
| `src/console/Console.tsx:L255` | `Console` | FunctionDeclaration | `logout(): inferred` |
| `src/console/Console.tsx:L370` | `Console` | FunctionVariable | `productName(id: string): inferred` |
| `src/console/Console.tsx:L372` | `Console` | FunctionVariable | `accountName(id: string): inferred` |
| `src/console/Console.tsx:L374` | `Console` | FunctionVariable | `matches(value: string): inferred` |
| `src/console/Console.tsx:L376` | `Console` | FunctionVariable | `activeProduct(id: string): inferred` |
| `src/console/Console.tsx:L880` | `<module>` | FunctionDeclaration | `EditorDialog({ editor, state, busy, error, close, save, }: { editor: Editor; state: Workspace; busy: boolean; error: string; close(): void; save(command: Command): Promise<boolean>; }): inferred` |
| `src/console/Console.tsx:L892` | `EditorDialog` | MethodSignature | `close(): void` |
| `src/console/Console.tsx:L893` | `EditorDialog` | MethodSignature | `save(command: Command): Promise<boolean>` |
| `src/console/Console.tsx:L924` | `EditorDialog` | FunctionVariable | `listener(e: Event): inferred` |
| `src/console/Console.tsx:L935` | `EditorDialog` | FunctionDeclaration | `submit(event: FormEvent<HTMLFormElement>): inferred` |

### src/console/EnvironmentSettings.tsx

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `src/console/EnvironmentSettings.tsx:L4` | `<module>` | TypeAliasDeclaration | `EnvironmentPreferences = { enabled: boolean; paused: boolean; cache: boolean; cacheMessage: string; stateLabel: string; playing: boolean; scene?: string; reduced: boolean; selection: string; onEnabled: (enabled: boolean) => void; onPaused: (paused: boolean) => void; onCache: (accepted: boolean) => void; onSelection: (selection: string) => void; onPreview: () => void; }` |
| `src/console/EnvironmentSettings.tsx:L11` | `<module>` | FunctionDeclaration | `EnvironmentSettings({ preferences: p, idPrefix, showCache }: { preferences: EnvironmentPreferences; idPrefix: string; showCache: boolean }): inferred` |

### src/console/Help.tsx

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `src/console/Help.tsx:L5` | `<module>` | TypeAliasDeclaration | `Copy = { en: string; es: string }` |
| `src/console/Help.tsx:L6` | `<module>` | TypeAliasDeclaration | `HelpStep = { title: Copy; text: Copy; image?: string; alt?: Copy; captureSelector?: string; }` |
| `src/console/Help.tsx:L13` | `<module>` | TypeAliasDeclaration | `HelpGuide = { title: Copy; steps: HelpStep[]; note?: Copy }` |
| `src/console/Help.tsx:L137` | `<module>` | TypeAliasDeclaration | `HelpTopic = keyof typeof helpGuides \| 'all'` |
| `src/console/Help.tsx:L139` | `<module>` | FunctionDeclaration | `Help({ topic, className , label }: { topic: HelpTopic; className?: string; label?: string }): inferred` |
| `src/console/Help.tsx:L150` | `<module>` | FunctionDeclaration | `HelpDialog({ topic, close }: { topic: HelpTopic; close(): void }): inferred` |
| `src/console/Help.tsx:L150` | `HelpDialog` | MethodSignature | `close(): void` |

### src/console/Settings.tsx

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `src/console/Settings.tsx:L7` | `<module>` | TypeAliasDeclaration | `Draft = { monthly: string; processing: string; ai: string; storage: string; duration: string }` |
| `src/console/Settings.tsx:L9` | `<module>` | FunctionVariable | `asDraft(s: StudioSettings): Draft` |
| `src/console/Settings.tsx:L10` | `<module>` | FunctionDeclaration | `recovered(): { draft?: Draft; revision?: number }` |
| `src/console/Settings.tsx:L15` | `<module>` | FunctionDeclaration | `Settings({ environment }: { environment?: ReactNode }): inferred` |
| `src/console/Settings.tsx:L17` | `Settings` | FunctionVariable | `l(es: string, en: string): inferred` |
| `src/console/Settings.tsx:L38` | `Settings` | FunctionDeclaration | `refresh(discard?: inferred): inferred` |
| `src/console/Settings.tsx:L46` | `Settings` | FunctionDeclaration | `change(key: keyof Draft, value: string): inferred` |
| `src/console/Settings.tsx:L47` | `Settings` | FunctionDeclaration | `values(): StudioSettingsValues` |
| `src/console/Settings.tsx:L49` | `Settings.values` | FunctionVariable | `cents(text: string): inferred` |
| `src/console/Settings.tsx:L56` | `Settings` | FunctionDeclaration | `save(): inferred` |
| `src/console/Settings.tsx:L66` | `Settings` | FunctionVariable | `usd(cents: number): inferred` |
| `src/console/Settings.tsx:L67` | `Settings` | FunctionVariable | `field(label: string, key: keyof Draft, min: string, max: string, step: string): inferred` |

### src/console/Studio.tsx

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `src/console/Studio.tsx:L10` | `<module>` | TypeAliasDeclaration | `Job = { id: string; variantId: string; recipeRevision: number; status: string; error?: string; sourceRefs?: Array<{ materialId: string; contentVersion: number; assetId?: string }> }` |
| `src/console/Studio.tsx:L11` | `<module>` | TypeAliasDeclaration | `Result = { state: StudioState; jobs: Job[]; usage?: Record<string, number>; uploads: Array<Upload & { name: string; size: number }>; capabilities: { local: boolean; render: boolean; analysis?: boolean; analysisCents?: number; defaultDurationSeconds?: number; maxFileBytes: number; maxChunkBytes: number; monthlyBudgetCents?: number; monthlyUsedCents?: number; storageBytes?: number; maxStorageBytes?: number } }` |
| `src/console/Studio.tsx:L12` | `<module>` | TypeAliasDeclaration | `Upload = { id: string; offset: number; status: string }` |
| `src/console/Studio.tsx:L15` | `<module>` | FunctionVariable | `comma(value: unknown): inferred` |
| `src/console/Studio.tsx:L16` | `<module>` | FunctionVariable | `assetUrl(id: string): inferred` |
| `src/console/Studio.tsx:L17` | `<module>` | FunctionDeclaration | `DraftForm({ draftKey, baseRevision, onDirty, onSubmit, className, children }: { draftKey: string; baseRevision?: number; onDirty?: (dirty: boolean) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; className: string; children: ReactNode }): inferred` |
| `src/console/Studio.tsx:L49` | `<module>` | FunctionDeclaration | `api<T>(path?: inferred, body?: unknown, method?: inferred): Promise<T>` |
| `src/console/Studio.tsx:L57` | `<module>` | FunctionDeclaration | `Studio({ view, workspace, onRecordingChange, onOpenCampaigns }: { view: "space" \| "campaigns"; workspace: Workspace; onRecordingChange: (active: boolean) => void; onOpenCampaigns?: () => void }): inferred` |
| `src/console/Studio.tsx:L59` | `Studio` | FunctionVariable | `l(es: string, en: string): inferred` |
| `src/console/Studio.tsx:L89` | `Studio` | FunctionVariable | `warn(event: BeforeUnloadEvent): inferred` |
| `src/console/Studio.tsx:L99` | `Studio` | FunctionDeclaration | `refresh(): inferred` |
| `src/console/Studio.tsx:L107` | `Studio` | FunctionDeclaration | `run(action: () => Promise<void>): inferred` |
| `src/console/Studio.tsx:L113` | `Studio` | FunctionDeclaration | `command(type: string, data: unknown): inferred` |
| `src/console/Studio.tsx:L119` | `Studio` | FunctionVariable | `field(label: string, children: ReactNode, wide?: inferred): inferred` |
| `src/console/Studio.tsx:L120` | `Studio` | FunctionDeclaration | `upload(file: File): inferred` |
| `src/console/Studio.tsx:L148` | `Studio` | FunctionDeclaration | `record(): inferred` |
| `src/console/Studio.tsx:L168` | `Studio` | FunctionDeclaration | `saveMaterial(event: FormEvent<HTMLFormElement>): inferred` |
| `src/console/Studio.tsx:L186` | `Studio` | FunctionVariable | `useCount(id: string): inferred` |
| `src/console/Studio.tsx:L188` | `Studio` | FunctionVariable | `rangeField(kind: "start" \| "end", id: string, index: number): inferred` |
| `src/console/Studio.tsx:L189` | `Studio` | FunctionDeclaration | `variantForm(event: FormEvent<HTMLFormElement>): inferred` |
| `src/console/Studio.tsx:L204` | `Studio` | FunctionDeclaration | `applyPlan(request: StudioPlanInput, fingerprint: string, alternative: number, revision: number): inferred` |

### src/console/StudioAnalysis.tsx

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `src/console/StudioAnalysis.tsx:L6` | `<module>` | TypeAliasDeclaration | `Analysis = { id: string; assetId: string; range: StudioAnalysisRange; profile: string; toolVersion: string; status: "queued" \| "running" \| "completed" \| "failed"; error?: string; result?: StudioAnalysisResult; thumbnails?: Array<{ name: string; time: number; url: string }>; }` |
| `src/console/StudioAnalysis.tsx:L11` | `<module>` | TypeAliasDeclaration | `Scan = StudioAnalysisRange & { assetId: string }` |
| `src/console/StudioAnalysis.tsx:L12` | `<module>` | TypeAliasDeclaration | `Props = { state: StudioState; available: boolean; local: boolean; busy: boolean; cents: number; onRequest: (range: Scan) => Promise<{ analysis: Analysis; cached: boolean; chargedCents: number }>; onRead: (id: string) => Promise<{ analysis: Analysis }>; onList: (assetId: string) => Promise<{ analyses: Analysis[] }>; onUsageRefresh: () => Promise<unknown>; onActiveChange: (active: boolean) => void; onUseRange: (choice: { analysisId: string; assetId: string; start: number; end: number }) => void; }` |
| `src/console/StudioAnalysis.tsx:L22` | `<module>` | FunctionDeclaration | `StudioAnalysis({ state, available, local, busy, cents, onRequest, onRead, onList, onUsageRefresh, onActiveChange, onUseRange }: Props): inferred` |
| `src/console/StudioAnalysis.tsx:L24` | `StudioAnalysis` | FunctionVariable | `l(es: string, en: string): inferred` |
| `src/console/StudioAnalysis.tsx:L38` | `StudioAnalysis` | FunctionVariable | `field(label: string, child: ReactNode): inferred` |
| `src/console/StudioAnalysis.tsx:L39` | `StudioAnalysis` | FunctionVariable | `name(id: string): inferred` |
| `src/console/StudioAnalysis.tsx:L40` | `StudioAnalysis` | FunctionVariable | `signal(kind: string): inferred` |
| `src/console/StudioAnalysis.tsx:L41` | `StudioAnalysis` | FunctionDeclaration | `remember(analysis: Analysis): inferred` |
| `src/console/StudioAnalysis.tsx:L42` | `StudioAnalysis` | FunctionDeclaration | `load(): inferred` |
| `src/console/StudioAnalysis.tsx:L47` | `StudioAnalysis` | FunctionDeclaration | `execute(): inferred` |

### src/console/StudioPlanner.tsx

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `src/console/StudioPlanner.tsx:L7` | `<module>` | TypeAliasDeclaration | `Props = { state: StudioState; workspace: Workspace; campaign: StudioCampaign; variant?: StudioVariant; initialCandidateIds: string[]; recipeDirty: boolean; busy: boolean; analysisChoice?: { analysisId: string; assetId: string; start: number; end: number }; onAnalysisChoiceUsed: () => void; defaultDurationSeconds?: number; onPropose: (request: StudioPlanInput) => Promise<StudioPlanResult>; onApply: (request: StudioPlanInput, fingerprint: string, alternative: number, revision: number) => Promise<void>; }` |
| `src/console/StudioPlanner.tsx:L16` | `<module>` | TypeAliasDeclaration | `Proposal = { result: StudioPlanResult; request: StudioPlanInput; revision: number }` |
| `src/console/StudioPlanner.tsx:L20` | `<module>` | FunctionDeclaration | `StudioPlanner({ state, workspace, campaign, variant, initialCandidateIds, recipeDirty, busy, defaultDurationSeconds, analysisChoice, onAnalysisChoiceUsed, onPropose, onApply }: Props): inferred` |
| `src/console/StudioPlanner.tsx:L22` | `StudioPlanner` | FunctionVariable | `l(es: string, en: string): inferred` |
| `src/console/StudioPlanner.tsx:L59` | `StudioPlanner` | FunctionDeclaration | `update(values: Partial<StudioPlanInput>): inferred` |
| `src/console/StudioPlanner.tsx:L65` | `StudioPlanner` | FunctionVariable | `field(label: string, child: ReactNode, wide?: inferred): inferred` |
| `src/console/StudioPlanner.tsx:L66` | `StudioPlanner` | FunctionVariable | `title(id: string): inferred` |
| `src/console/StudioPlanner.tsx:L67` | `StudioPlanner` | FunctionDeclaration | `toggle(id: string, checked: boolean): inferred` |
| `src/console/StudioPlanner.tsx:L71` | `StudioPlanner` | FunctionDeclaration | `chooseSource(id: string, kind: "text" \| "narration"): inferred` |
| `src/console/StudioPlanner.tsx:L77` | `StudioPlanner` | FunctionDeclaration | `propose(): inferred` |
| `src/console/StudioPlanner.tsx:L87` | `StudioPlanner` | FunctionDeclaration | `apply(): inferred` |

### src/console/TextSimulation.tsx

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `src/console/TextSimulation.tsx:L8` | `<module>` | FunctionDeclaration | `TextSimulation({ workspace, disabled, onSaved }: { workspace: Workspace; disabled: boolean; onSaved: (workspace: Workspace) => void; }): inferred` |
| `src/console/TextSimulation.tsx:L41` | `TextSimulation` | FunctionDeclaration | `resetResult(): inferred` |
| `src/console/TextSimulation.tsx:L47` | `TextSimulation` | FunctionDeclaration | `generate(): inferred` |
| `src/console/TextSimulation.tsx:L67` | `TextSimulation` | FunctionDeclaration | `save(): inferred` |

### src/core/client.ts

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `src/core/client.ts:L2` | `<module>` | FunctionDeclaration | `request<T>(url: string, data?: unknown): Promise<T>` |
| `src/core/client.ts:L21` | `<module>` | FunctionVariable | `loadWorkspace(): inferred` |
| `src/core/client.ts:L22` | `<module>` | FunctionVariable | `sendCommand(revision: number, command: Command): inferred` |
| `src/core/client.ts:L24` | `<module>` | FunctionDeclaration | `exportText(filename: string, content: string): inferred` |

### src/core/domain.ts

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `src/core/domain.ts:L8` | `<module>` | TypeAliasDeclaration | `Platform = (typeof platforms)[number]` |
| `src/core/domain.ts:L9` | `<module>` | TypeAliasDeclaration | `Product = { id: string; name: string; description: string; audience: string; language: string; tone: string; cta: string; url: string; status: "preparation" \| "available" \| "paused"; }` |
| `src/core/domain.ts:L20` | `<module>` | TypeAliasDeclaration | `Account = { id: string; name: string; platform: Platform; url: string; productIds: string[]; timezone: string; language: string; }` |
| `src/core/domain.ts:L29` | `<module>` | TypeAliasDeclaration | `Source = { id: string; productId: string; title: string; text: string; declaredDate: string; createdAt: string; }` |
| `src/core/domain.ts:L37` | `<module>` | TypeAliasDeclaration | `Campaign = { id: string; productId: string; title: string; objective: string; audience: string; sourceIds: string[]; kind: "organic" \| "paid"; currency: string; budget: string; status: "draft" \| "paused"; createdAt: string; }` |
| `src/core/domain.ts:L50` | `<module>` | TypeAliasDeclaration | `Post = { id: string; campaignId: string; accountId: string; text: string; scheduledAt: string; status: "draft" \| "ready" \| "scheduled" \| "published"; formatConfirmed: boolean; externalUrl: string; }` |
| `src/core/domain.ts:L60` | `<module>` | TypeAliasDeclaration | `Workspace = { version: 1; revision: number; products: Product[]; accounts: Account[]; sources: Source[]; campaigns: Campaign[]; posts: Post[]; }` |
| `src/core/domain.ts:L69` | `<module>` | TypeAliasDeclaration | `Command = { type: string; data: Record<string, unknown> }` |
| `src/core/domain.ts:L70` | `<module>` | ClassDeclaration | `DomainError` |
| `src/core/domain.ts:L72` | `DomainError` | Constructor | `constructor(message: string, status?: inferred): inferred` |
| `src/core/domain.ts:L77` | `<module>` | FunctionDeclaration | `emptyWorkspace(): Workspace` |
| `src/core/domain.ts:L88` | `<module>` | FunctionDeclaration | `object(value: unknown): Record<string, unknown>` |
| `src/core/domain.ts:L93` | `<module>` | FunctionDeclaration | `text(data: Record<string, unknown>, key: string, max?: inferred, required?: inferred, trim?: inferred): string` |
| `src/core/domain.ts:L111` | `<module>` | FunctionDeclaration | `ids(data: Record<string, unknown>, key: string): string[]` |
| `src/core/domain.ts:L121` | `<module>` | FunctionDeclaration | `choice<T extends string>(data: Record<string, unknown>, key: string, values: readonly T[]): T` |
| `src/core/domain.ts:L131` | `<module>` | FunctionDeclaration | `safeUrl(value: string): string` |
| `src/core/domain.ts:L143` | `<module>` | FunctionDeclaration | `find<T extends { id: string }>(items: T[], id: string): T` |
| `src/core/domain.ts:L149` | `<module>` | FunctionDeclaration | `upsert<T extends { id: string }>(items: T[], item: T, editing: boolean): inferred` |
| `src/core/domain.ts:L161` | `<module>` | FunctionDeclaration | `sourceInUse(state: Workspace, id: string): boolean` |
| `src/core/domain.ts:L164` | `<module>` | FunctionDeclaration | `applyCommand(previous: Workspace, command: Command, now?: inferred, newId?: inferred): Workspace` |

### src/core/generation.ts

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `src/core/generation.ts:L13` | `<module>` | TypeAliasDeclaration | `TextSimulationRequest = { requestId: string; revision: number; campaignId: string; postId: string; sourceIds: string[]; }` |
| `src/core/generation.ts:L20` | `<module>` | TypeAliasDeclaration | `SimulatedTextResult = { readonly simulated: true; readonly request: Readonly<Omit<TextSimulationRequest, "sourceIds"> & { sourceIds: readonly string[] }>; readonly productId: string; readonly accountId: string; readonly sourceIds: readonly string[]; readonly text: string; readonly createdAt: number; readonly expiresAt: number; }` |
| `src/core/generation.ts:L30` | `<module>` | TypeAliasDeclaration | `SimulationMode = "success" \| "error" \| "timeout" \| "malformed-text" \| "malformed-destination"` |
| `src/core/generation.ts:L31` | `<module>` | TypeAliasDeclaration | `Entry = { fingerprint: string; snapshot: string; expiresAt: number; promise: Promise<SimulatedTextResult>; result?: SimulatedTextResult; savePrepared?: boolean; cancel: () => void; expiryTimer: ReturnType<typeof setTimeout>; }` |
| `src/core/generation.ts:L42` | `<module>` | FunctionDeclaration | `snapshot(state: Workspace): string` |
| `src/core/generation.ts:L48` | `<module>` | FunctionDeclaration | `selection(state: Workspace, request: Readonly<Omit<TextSimulationRequest, "sourceIds"> & { sourceIds: readonly string[] }>): inferred` |
| `src/core/generation.ts:L72` | `<module>` | FunctionDeclaration | `validText(value: unknown): value is string` |
| `src/core/generation.ts:L77` | `<module>` | FunctionDeclaration | `createTextSimulation(options?: { latencyMs?: number; timeoutMs?: number; now?: () => number }): inferred` |
| `src/core/generation.ts:L86` | `createTextSimulation` | FunctionDeclaration | `discard(requestId: string, entry: Entry): inferred` |
| `src/core/generation.ts:L94` | `createTextSimulation` | FunctionDeclaration | `prune(): inferred` |
| `src/core/generation.ts:L97` | `createTextSimulation` | FunctionDeclaration | `generate(state: Workspace, input: TextSimulationRequest, run?: { mode?: SimulationMode; signal?: AbortSignal }): Promise<SimulatedTextResult>` |
| `src/core/generation.ts:L122` | `createTextSimulation.generate` | FunctionVariable | `cancel(): inferred` |
| `src/core/generation.ts:L127` | `createTextSimulation.generate` | FunctionVariable | `finish(error?: Error, result?: SimulatedTextResult): inferred` |
| `src/core/generation.ts:L164` | `createTextSimulation` | FunctionDeclaration | `prepareSave(state: Workspace, result: SimulatedTextResult, editedText: string): { revision: number; command: Command }` |
| `src/core/generation.ts:L182` | `createTextSimulation` | FunctionDeclaration | `clear(): inferred` |

### src/core/settings.ts

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `src/core/settings.ts:L5` | `<module>` | TypeAliasDeclaration | `StudioSettingsValues = { monthlyBudgetCents: number; processingBudgetCents: number; aiBudgetCents: number; storageLimitBytes: number; defaultDurationSeconds: number; }` |
| `src/core/settings.ts:L9` | `<module>` | TypeAliasDeclaration | `StudioSettings = StudioSettingsValues & { revision: number }` |
| `src/core/settings.ts:L10` | `<module>` | TypeAliasDeclaration | `StudioSettingsResponse = { settings: StudioSettings; usage: { month: string; processingUsedCents: number; aiUsedCents: 0; storageBytes: number; reservedBytes: number }; limits: { maxBudgetCents: number; maxStorageBytes: number }; ai: { connected: false }; }` |
| `src/core/settings.ts:L16` | `<module>` | FunctionDeclaration | `defaultStudioSettings(): StudioSettings` |
| `src/core/settings.ts:L22` | `<module>` | FunctionDeclaration | `validateStudioSettings(value: unknown): StudioSettingsValues` |

### src/core/studio-analysis.ts

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `src/core/studio-analysis.ts:L12` | `<module>` | TypeAliasDeclaration | `StudioAnalysisRange = { start: number; end: number }` |
| `src/core/studio-analysis.ts:L13` | `<module>` | TypeAliasDeclaration | `StudioAnalysisInterval = { kind: "scene" \| "silence" \| "black" \| "freeze"; start: number; end: number; }` |
| `src/core/studio-analysis.ts:L17` | `<module>` | TypeAliasDeclaration | `StudioAnalysisResult = { profile: typeof ANALYSIS_PROFILE; toolVersion: string; range: StudioAnalysisRange; status: "complete" \| "partial" \| "unavailable"; intervals: StudioAnalysisInterval[]; thumbnails: Array<{ name: string; time: number }>; warnings: string[]; }` |
| `src/core/studio-analysis.ts:L28` | `<module>` | FunctionDeclaration | `validateAnalysisRange(supplied: unknown): StudioAnalysisRange` |
| `src/core/studio-analysis.ts:L42` | `<module>` | FunctionDeclaration | `validateAnalysisResult(supplied: unknown, expectedRange?: StudioAnalysisRange): StudioAnalysisResult` |

### src/core/studio-planner.ts

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `src/core/studio-planner.ts:L6` | `<module>` | TypeAliasDeclaration | `StudioPlannerUse = { sha256: string; start: number; end: number; variantId?: string; jobId?: string }` |
| `src/core/studio-planner.ts:L7` | `<module>` | InterfaceDeclaration | `StudioPlanInput` |
| `src/core/studio-planner.ts:L15` | `<module>` | TypeAliasDeclaration | `StudioPlanRecipe = Pick<StudioVariant, "campaignId" \| "platform" \| "template" \| "hook" \| "body" \| "cta" \| "duration" \| "fit" \| "focusX" \| "focusY" \| "audio" \| "sourceIds" \| "selections" \| "narrationId">` |
| `src/core/studio-planner.ts:L16` | `<module>` | InterfaceDeclaration | `StudioPlanProvenance` |
| `src/core/studio-planner.ts:L23` | `<module>` | InterfaceDeclaration | `StudioPlanProposal` |
| `src/core/studio-planner.ts:L24` | `<module>` | InterfaceDeclaration | `StudioPlanResult` |
| `src/core/studio-planner.ts:L26` | `<module>` | FunctionDeclaration | `fail(message: string, status?: inferred): never` |
| `src/core/studio-planner.ts:L27` | `<module>` | FunctionDeclaration | `canonical(value: unknown): string` |
| `src/core/studio-planner.ts:L32` | `<module>` | FunctionDeclaration | `milliseconds(value: number): number` |
| `src/core/studio-planner.ts:L33` | `<module>` | FunctionDeclaration | `materialFacts(state: StudioState, material: StudioMaterial): string` |
| `src/core/studio-planner.ts:L37` | `<module>` | FunctionDeclaration | `campaignFacts(state: StudioState, campaignId: string): string` |
| `src/core/studio-planner.ts:L42` | `<module>` | FunctionDeclaration | `inputCheck(input: StudioPlanInput): inferred` |
| `src/core/studio-planner.ts:L61` | `<module>` | FunctionDeclaration | `preflightStudioPlanCopy(template: StudioTemplate, hook: string, body: string, cta: string, duration: number): void` |
| `src/core/studio-planner.ts:L76` | `<module>` | FunctionDeclaration | `eligible(state: StudioState, material: StudioMaterial, productId: string, input: Pick<StudioPlanInput, "includeShared" \| "reviewedMaterialIds">): string \| undefined` |
| `src/core/studio-planner.ts:L86` | `<module>` | FunctionDeclaration | `liveUses(state: StudioState): StudioPlannerUse[]` |
| `src/core/studio-planner.ts:L93` | `<module>` | FunctionDeclaration | `validateHistory(history: StudioPlannerUse[]): inferred` |
| `src/core/studio-planner.ts:L97` | `<module>` | FunctionDeclaration | `overlaps(sha: string, start: number, end: number, uses: StudioPlannerUse[], variantId?: string): boolean` |
| `src/core/studio-planner.ts:L100` | `<module>` | TypeAliasDeclaration | `Candidate = { material: StudioMaterial; sha: string; start: number; capacity: number; rank: number[]; warnings: string[] }` |
| `src/core/studio-planner.ts:L101` | `<module>` | FunctionDeclaration | `rank(a: Candidate, b: Candidate): number` |
| `src/core/studio-planner.ts:L105` | `<module>` | FunctionDeclaration | `unusedIntervals(start: number, end: number, sha: string, uses: StudioPlannerUse[], variantId?: string): Array<[number, number]>` |
| `src/core/studio-planner.ts:L117` | `<module>` | FunctionDeclaration | `combinations<T>(items: T[], count: number, offset?: inferred, prefix?: T[]): Generator<T[]>` |
| `src/core/studio-planner.ts:L122` | `<module>` | FunctionDeclaration | `planStudio(state: StudioState, workspace: Workspace, supplied: StudioPlanInput, history?: StudioPlannerUse[]): Promise<StudioPlanResult>` |
| `src/core/studio-planner.ts:L213` | `<module>` | FunctionDeclaration | `validatePlannedVariant(state: StudioState, variant: StudioVariant, history?: StudioPlannerUse[], workspace?: Workspace): void` |

### src/core/studio.ts

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `src/core/studio.ts:L12` | `<module>` | TypeAliasDeclaration | `MaterialKind = "video" \| "image" \| "audio" \| "text" \| "idea"` |
| `src/core/studio.ts:L13` | `<module>` | TypeAliasDeclaration | `MaterialCategory = (typeof materialCategories)[number]` |
| `src/core/studio.ts:L14` | `<module>` | TypeAliasDeclaration | `MaterialRole = (typeof materialRoles)[number]` |
| `src/core/studio.ts:L15` | `<module>` | TypeAliasDeclaration | `StudioTemplate = (typeof studioTemplates)[number]` |
| `src/core/studio.ts:L16` | `<module>` | TypeAliasDeclaration | `StudioAsset = { id: string; name: string; mime: string; size: number; sha256: string; kind: "video" \| "image" \| "audio"; duration?: number; width?: number; height?: number; audioTrack: "present" \| "absent" \| "unknown"; processing: "ready" \| "unsupported"; createdAt: string; }` |
| `src/core/studio.ts:L24` | `<module>` | TypeAliasDeclaration | `StudioMaterialOrigin = { kind: "legacy-source"; sourceId: string; productId: string; title: string; text: string; declaredDate: string; createdAt: string; }` |
| `src/core/studio.ts:L28` | `<module>` | TypeAliasDeclaration | `StudioMaterial = { id: string; title: string; kind: MaterialKind; productIds: string[]; categories: MaterialCategory[]; topics: string[]; roles: MaterialRole[]; review: "unreviewed" \| "classified" \| "ready"; text: string; description: string; speech: "unknown" \| "present" \| "absent"; rights: "unknown" \| "owned" \| "licensed" \| "restricted"; restrictions: string; usefulStart?: number; usefulEnd?: number; assetId?: string; origin?: StudioMaterialOrigin; contentVersion: number; createdAt: string; updatedAt: string; }` |
| `src/core/studio.ts:L38` | `<module>` | TypeAliasDeclaration | `StudioCampaign = { id: string; productId: string; title: string; objective: string; audience: string; kind: "organic" \| "paid"; status: "draft" \| "paused"; createdAt: string; updatedAt: string; }` |
| `src/core/studio.ts:L43` | `<module>` | TypeAliasDeclaration | `StudioSelection = { materialId: string; start: number; end: number }` |
| `src/core/studio.ts:L44` | `<module>` | TypeAliasDeclaration | `StudioSourceSnapshot = { materialId: string; contentVersion: number; assetId?: string; kind: MaterialKind; title: string; text: string; speech: StudioMaterial["speech"]; rights: StudioMaterial["rights"]; restrictions: string; origin?: StudioMaterialOrigin; }` |
| `src/core/studio.ts:L50` | `<module>` | TypeAliasDeclaration | `StudioVariant = { id: string; campaignId: string; platform: Platform; template: StudioTemplate; templateVersion: 1; hook: string; body: string; cta: string; duration: number; fit: "contain" \| "cover"; focusX: number; focusY: number; audio: "mute" \| "keep"; sourceIds: string[]; selections: StudioSelection[]; narrationId?: string; sourceSnapshots: StudioSourceSnapshot[]; recipeRevision: number; planner?: StudioPlanProvenance; status: "draft" \| "approved"; approvedRecipeRevision?: number; approvedJobId?: string; createdAt: string; updatedAt: string; }` |
| `src/core/studio.ts:L61` | `<module>` | TypeAliasDeclaration | `StudioState = { version: 1; revision: number; assets: StudioAsset[]; materials: StudioMaterial[]; campaigns: StudioCampaign[]; variants: StudioVariant[]; }` |
| `src/core/studio.ts:L65` | `<module>` | TypeAliasDeclaration | `TrustedStudioRender = { variantId: string; recipeRevision: number; jobId: string }` |
| `src/core/studio.ts:L66` | `<module>` | TypeAliasDeclaration | `StudioCommandContext = { now?: string; newId?: () => string; trustedRender?: TrustedStudioRender; trustedPlan?: StudioPlanProposal }` |
| `src/core/studio.ts:L67` | `<module>` | TypeAliasDeclaration | `StudioRenderSpec = { variantId: string; recipeRevision: number; template: StudioTemplate; templateVersion: 1; duration: number; hook: string; body: string; cta: string; fit: "contain" \| "cover"; focusX: number; focusY: number; audio: "mute" \| "keep"; clips: Array<{ assetId: string; kind: "video" \| "image" \| "audio"; start: number; end: number }>; narrationAssetId?: string; }` |
| `src/core/studio.ts:L76` | `<module>` | FunctionDeclaration | `emptyStudio(): StudioState` |
| `src/core/studio.ts:L79` | `<module>` | FunctionDeclaration | `str(data: Record<string, unknown>, key: string, max?: inferred, required?: inferred, trim?: inferred): string` |
| `src/core/studio.ts:L85` | `<module>` | FunctionDeclaration | `num(data: Record<string, unknown>, key: string, min: number, max: number): number` |
| `src/core/studio.ts:L91` | `<module>` | FunctionDeclaration | `pick<T extends string>(data: Record<string, unknown>, key: string, values: readonly T[]): T` |
| `src/core/studio.ts:L95` | `<module>` | FunctionDeclaration | `list(data: Record<string, unknown>, key: string, max?: inferred): string[]` |
| `src/core/studio.ts:L101` | `<module>` | FunctionDeclaration | `options<T extends string>(data: Record<string, unknown>, key: string, values: readonly T[]): T[]` |
| `src/core/studio.ts:L106` | `<module>` | FunctionDeclaration | `find<T extends { id: string }>(items: readonly T[], id: string): T` |
| `src/core/studio.ts:L111` | `<module>` | FunctionDeclaration | `store<T extends { id: string }>(items: T[], item: T, previous?: T): inferred` |
| `src/core/studio.ts:L119` | `<module>` | FunctionDeclaration | `verifiedState(state: StudioState): inferred` |
| `src/core/studio.ts:L123` | `<module>` | FunctionDeclaration | `changedState(state: StudioState): StudioState` |
| `src/core/studio.ts:L129` | `<module>` | FunctionDeclaration | `unapprove(variant: StudioVariant): inferred` |
| `src/core/studio.ts:L134` | `<module>` | FunctionDeclaration | `confirm(data: Record<string, unknown>): inferred` |
| `src/core/studio.ts:L137` | `<module>` | FunctionDeclaration | `snapshot(material: StudioMaterial): StudioSourceSnapshot` |
| `src/core/studio.ts:L143` | `<module>` | FunctionDeclaration | `materialUses(state: StudioState, materialId: string): StudioVariant[]` |
| `src/core/studio.ts:L149` | `<module>` | FunctionDeclaration | `registerStudioAsset(previous: StudioState, supplied: StudioAsset): StudioState` |
| `src/core/studio.ts:L172` | `<module>` | FunctionDeclaration | `saveMaterial(state: StudioState, workspace: Workspace, data: Record<string, unknown>, id: string, old: StudioMaterial \| undefined, now: string): inferred` |
| `src/core/studio.ts:L221` | `<module>` | FunctionDeclaration | `selections(data: Record<string, unknown>, sourceIds: string[], sourceSnapshots: StudioSourceSnapshot[]): StudioSelection[]` |
| `src/core/studio.ts:L237` | `<module>` | FunctionDeclaration | `saveVariant(state: StudioState, data: Record<string, unknown>, id: string, old: StudioVariant \| undefined, now: string): inferred` |
| `src/core/studio.ts:L267` | `saveVariant` | FunctionVariable | `recipe(item: StudioVariant): inferred` |
| `src/core/studio.ts:L280` | `<module>` | FunctionDeclaration | `assertRights(state: StudioState, variant: StudioVariant): inferred` |
| `src/core/studio.ts:L292` | `<module>` | FunctionDeclaration | `assertCopy(variant: StudioVariant): inferred` |
| `src/core/studio.ts:L298` | `<module>` | FunctionDeclaration | `buildRenderSpec(state: StudioState, variantId: string): StudioRenderSpec` |
| `src/core/studio.ts:L335` | `<module>` | FunctionDeclaration | `assertStudioExportable(state: StudioState, variantId: string, jobId?: string): StudioVariant` |
| `src/core/studio.ts:L347` | `<module>` | FunctionDeclaration | `applyStudioCommand(previous: StudioState, workspace: Workspace, command: Command, context?: StudioCommandContext): StudioState` |

### src/decoration/Background.tsx

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `src/decoration/Background.tsx:L7` | `<module>` | TypeAliasDeclaration | `PlaybackState = { phase: 'rest' \| 'playing' \| 'paused' \| 'reduced'; scene?: string }` |
| `src/decoration/Background.tsx:L9` | `<module>` | FunctionDeclaration | `Background({ assets, preview, paused , width , margin , openingScene, onState }: { assets: DecorativeAssets; preview?: { id: string; nonce: number }; paused?: boolean; width?: number; margin?: number; openingScene?: string; onState?: (state: PlaybackState) => void; }): inferred` |
| `src/decoration/Background.tsx:L14` | `Background` | MethodSignature | `play(id: string): void` |
| `src/decoration/Background.tsx:L14` | `Background` | MethodSignature | `visibility(): void` |
| `src/decoration/Background.tsx:L29` | `Background` | FunctionVariable | `isPaused(): inferred` |
| `src/decoration/Background.tsx:L30` | `Background` | FunctionVariable | `report(): inferred` |
| `src/decoration/Background.tsx:L36` | `Background` | FunctionVariable | `stopFrames(): inferred` |
| `src/decoration/Background.tsx:L37` | `Background` | FunctionVariable | `resumeFrames(): inferred` |
| `src/decoration/Background.tsx:L38` | `Background` | FunctionDeclaration | `tick(now: number): inferred` |
| `src/decoration/Background.tsx:L47` | `Background` | FunctionDeclaration | `finish(): inferred` |
| `src/decoration/Background.tsx:L72` | `Background` | FunctionDeclaration | `visibility(): inferred` |
| `src/decoration/Background.tsx:L84` | `Background` | FunctionDeclaration | `motion(): inferred` |
| `src/decoration/Background.tsx:L90` | `Background` | FunctionVariable | `play(id: string): inferred` |

### src/decoration/assets.ts

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `src/decoration/assets.ts:L6` | `<module>` | FunctionDeclaration | `boundedBlob(response: Response, maximum?: inferred): Promise<Blob>` |
| `src/decoration/assets.ts:L22` | `<module>` | ClassDeclaration | `DecorativeAssets` |
| `src/decoration/assets.ts:L29` | `DecorativeAssets` | Constructor | `constructor(storage?: () => CacheStorage \| undefined, fetcher?: typeof fetch): inferred` |
| `src/decoration/assets.ts:L32` | `DecorativeAssets` | MethodDeclaration | `serialize<T>(operation: () => Promise<T>): Promise<T>` |
| `src/decoration/assets.ts:L35` | `DecorativeAssets` | MethodDeclaration | `purge(storage: CacheStorage, keep?: string): inferred` |
| `src/decoration/assets.ts:L38` | `DecorativeAssets` | MethodDeclaration | `setConsent(accepted: boolean): Promise<string>` |
| `src/decoration/assets.ts:L57` | `DecorativeAssets` | MethodDeclaration | `load(): Promise<Blob>` |
| `src/decoration/assets.ts:L61` | `DecorativeAssets` | MethodDeclaration | `fetchBlob(): Promise<Blob>` |

### src/decoration/registry.ts

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `src/decoration/registry.ts:L4` | `<module>` | TypeAliasDeclaration | `Scene = Episode & { label: string; version: number; resources: readonly string[]; winner?: 'codex'; load(): Promise<{ start(stage: Stage): void; frame(stage: Stage, progress: number): void; finish(stage: Stage): void }>; }` |
| `src/decoration/registry.ts:L6` | `<module>` | MethodSignature | `load(): Promise<{ start(stage: Stage): void; frame(stage: Stage, progress: number): void; finish(stage: Stage): void }>` |
| `src/decoration/registry.ts:L6` | `load` | MethodSignature | `start(stage: Stage): void` |
| `src/decoration/registry.ts:L6` | `load` | MethodSignature | `frame(stage: Stage, progress: number): void` |
| `src/decoration/registry.ts:L6` | `load` | MethodSignature | `finish(stage: Stage): void` |

### src/decoration/renderer.ts

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `src/decoration/renderer.ts:L1` | `<module>` | TypeAliasDeclaration | `Character = 'claude' \| 'codex'` |
| `src/decoration/renderer.ts:L2` | `<module>` | TypeAliasDeclaration | `View = 'front' \| 'threeQuarter' \| 'side' \| 'back'` |
| `src/decoration/renderer.ts:L3` | `<module>` | TypeAliasDeclaration | `Pose = 'idle' \| 'run' \| 'guard' \| 'punch' \| 'kick' \| 'airkick' \| 'flip' \| 'duck' \| 'bow' \| 'victory' \| 'dance' \| 'throw' \| 'cueca' \| 'zapateo'` |
| `src/decoration/renderer.ts:L4` | `<module>` | TypeAliasDeclaration | `Expression = 'smile' \| 'surprise' \| 'happy'` |
| `src/decoration/renderer.ts:L5` | `<module>` | TypeAliasDeclaration | `ActorPose = { x: number; y: number; facing: 1 \| -1; rotation: number; view: View; pose: Pose; stride: number; expression: Expression; shadowY: number; scale: number; costume?: 'huaso'; }` |
| `src/decoration/renderer.ts:L10` | `<module>` | TypeAliasDeclaration | `Pixel = [number, number, number, number, string]` |
| `src/decoration/renderer.ts:L19` | `<module>` | FunctionDeclaration | `torsoPixels(who: Character, view: View): Pixel[]` |
| `src/decoration/renderer.ts:L21` | `torsoPixels` | FunctionVariable | `r(x: number, y: number, w: number, h: number, color: string): inferred` |
| `src/decoration/renderer.ts:L66` | `<module>` | TypeAliasDeclaration | `Point = [number, number]` |
| `src/decoration/renderer.ts:L67` | `<module>` | TypeAliasDeclaration | `Limbs = { rearArm: Point[]; arm: Point[]; rearLeg: Point[]; leg: Point[] }` |
| `src/decoration/renderer.ts:L68` | `<module>` | FunctionDeclaration | `limbs(p: ActorPose, who: Character): Limbs` |
| `src/decoration/renderer.ts:L124` | `<module>` | ClassDeclaration | `Stage` |
| `src/decoration/renderer.ts:L127` | `Stage` | Constructor | `constructor(canvas: HTMLCanvasElement): inferred` |
| `src/decoration/renderer.ts:L128` | `Stage` | MethodDeclaration | `clear(): inferred` |
| `src/decoration/renderer.ts:L129` | `Stage` | MethodDeclaration | `rect(x: number, y: number, w: number, h: number, color: string): inferred` |
| `src/decoration/renderer.ts:L130` | `Stage` | MethodDeclaration | `line(points: number[][], color: string, width?: inferred): inferred` |
| `src/decoration/renderer.ts:L137` | `Stage` | MethodDeclaration | `actor(who: Character, pose: ActorPose): inferred` |
| `src/decoration/renderer.ts:L144` | `Stage.actor` | FunctionVariable | `limb(points: Point[], front: boolean, foot?: inferred): inferred` |
| `src/decoration/renderer.ts:L166` | `Stage` | MethodDeclaration | `poncho(who: Character, pose: ActorPose): inferred` |
| `src/decoration/renderer.ts:L176` | `Stage` | MethodDeclaration | `hat(who: Character, view: View): inferred` |
| `src/decoration/renderer.ts:L182` | `Stage` | MethodDeclaration | `handkerchief(hand: Point, stride: number): inferred` |
| `src/decoration/renderer.ts:L190` | `Stage` | MethodDeclaration | `face(who: Character, view: View, expression: Expression): inferred` |
| `src/decoration/renderer.ts:L204` | `Stage` | MethodDeclaration | `character(who: Character, x: number, y?: inferred, jump?: inferred, tilt?: inferred, face?: Expression): inferred` |
| `src/decoration/renderer.ts:L207` | `Stage` | MethodDeclaration | `idle(): inferred` |
| `src/decoration/renderer.ts:L208` | `Stage` | MethodDeclaration | `sparkle(x: number, y: number, color?: inferred): inferred` |
| `src/decoration/renderer.ts:L209` | `Stage` | MethodDeclaration | `label(text: string, x: number, y: number, color?: inferred): inferred` |

### src/decoration/scenes.ts

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `src/decoration/scenes.ts:L3` | `<module>` | TypeAliasDeclaration | `SceneId = 'kungfu' \| 'swords' \| 'lasers' \| 'stones' \| 'tennis' \| 'grill' \| 'dance' \| 'cueca'` |
| `src/decoration/scenes.ts:L4` | `<module>` | TypeAliasDeclaration | `SceneSample = { claude: ActorPose; codex: ActorPose; phase: 'intro' \| 'action' \| 'payoff' \| 'return'; variant: number }` |
| `src/decoration/scenes.ts:L5` | `<module>` | TypeAliasDeclaration | `Key = { t: number; x: number; y: number; pose: Pose; view: View; rotation: number; ground: number }` |
| `src/decoration/scenes.ts:L6` | `<module>` | FunctionVariable | `clamp(n: number, low?: inferred, high?: inferred): inferred` |
| `src/decoration/scenes.ts:L7` | `<module>` | FunctionVariable | `ease(n: number): inferred` |
| `src/decoration/scenes.ts:L8` | `<module>` | FunctionVariable | `mix(a: number, b: number, t: number): inferred` |
| `src/decoration/scenes.ts:L9` | `<module>` | FunctionVariable | `key(t: number, x: number, y?: inferred, pose?: Pose, view?: View, rotation?: inferred, ground?: inferred): Key` |
| `src/decoration/scenes.ts:L10` | `<module>` | FunctionVariable | `home(who: Character, t: number): inferred` |
| `src/decoration/scenes.ts:L19` | `<module>` | FunctionDeclaration | `standardTrack(id: SceneId, who: Character): Key[]` |
| `src/decoration/scenes.ts:L20` | `standardTrack` | FunctionVariable | `x(v: number): inferred` |
| `src/decoration/scenes.ts:L32` | `<module>` | FunctionDeclaration | `sampleTrack(keys: readonly Key[], p: number, who: Character): ActorPose` |
| `src/decoration/scenes.ts:L50` | `<module>` | FunctionDeclaration | `varyPosition(actor: ActorPose, id: SceneId, who: Character, p: number, v: number): inferred` |
| `src/decoration/scenes.ts:L74` | `<module>` | FunctionDeclaration | `varyChoreography(actor: ActorPose, id: SceneId, who: Character, p: number, v: number): inferred` |
| `src/decoration/scenes.ts:L91` | `<module>` | FunctionDeclaration | `sampleCueca(p: number, variant: number): SceneSample` |
| `src/decoration/scenes.ts:L93` | `sampleCueca` | FunctionVariable | `orbit(who: Character, turn: number): inferred` |
| `src/decoration/scenes.ts:L104` | `sampleCueca` | FunctionVariable | `between(from: ReturnType<typeof orbit>, to: ReturnType<typeof orbit>, q: number): inferred` |
| `src/decoration/scenes.ts:L134` | `<module>` | FunctionDeclaration | `sampleScene(id: SceneId, progress: number, variant?: inferred): SceneSample` |
| `src/decoration/scenes.ts:L157` | `<module>` | FunctionDeclaration | `propAt(s: Stage, a: ActorPose, draw: ()=>void): inferred` |
| `src/decoration/scenes.ts:L158` | `<module>` | FunctionDeclaration | `sword(s: Stage, a: ActorPose, cyan: boolean, p: number): inferred` |
| `src/decoration/scenes.ts:L159` | `<module>` | FunctionDeclaration | `racket(s: Stage, a: ActorPose): inferred` |
| `src/decoration/scenes.ts:L160` | `<module>` | FunctionDeclaration | `puff(s: Stage, x: number, y: number, amount: number, color?: inferred): inferred` |
| `src/decoration/scenes.ts:L163` | `<module>` | FunctionDeclaration | `createScene(id: SceneId, competitive: boolean, seed?: number): inferred` |
| `src/decoration/scenes.ts:L166` | `createScene` | MethodDeclaration | `start(s: Stage): inferred` |
| `src/decoration/scenes.ts:L167` | `createScene` | MethodDeclaration | `finish(s: Stage): inferred` |
| `src/decoration/scenes.ts:L168` | `createScene` | MethodDeclaration | `frame(s: Stage, progress: number): inferred` |

### src/decoration/scheduler.ts

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `src/decoration/scheduler.ts:L1` | `<module>` | TypeAliasDeclaration | `Episode = { id: string; duration: number; weight: number }` |
| `src/decoration/scheduler.ts:L2` | `<module>` | TypeAliasDeclaration | `Clock = { now(): number; set(callback: () => void, delay: number): unknown; clear(handle: unknown): void; }` |
| `src/decoration/scheduler.ts:L3` | `<module>` | MethodSignature | `now(): number` |
| `src/decoration/scheduler.ts:L4` | `<module>` | MethodSignature | `set(callback: () => void, delay: number): unknown` |
| `src/decoration/scheduler.ts:L5` | `<module>` | MethodSignature | `clear(handle: unknown): void` |
| `src/decoration/scheduler.ts:L13` | `<module>` | FunctionDeclaration | `chooseScene<T extends Episode>(items: readonly T[], previous: string \| undefined, random?: inferred): T` |
| `src/decoration/scheduler.ts:L21` | `<module>` | ClassDeclaration | `EpisodeScheduler<T extends Episode>` |
| `src/decoration/scheduler.ts:L36` | `EpisodeScheduler` | Constructor | `constructor(items: readonly T[], onStart: (scene: T) => void, onEnd: () => void, clock?: inferred, random?: inferred): inferred` |
| `src/decoration/scheduler.ts:L39` | `EpisodeScheduler` | MethodDeclaration | `start(paused?: inferred): inferred` |
| `src/decoration/scheduler.ts:L40` | `EpisodeScheduler` | MethodDeclaration | `schedule(delay: number, callback: () => void): inferred` |
| `src/decoration/scheduler.ts:L47` | `EpisodeScheduler` | MethodDeclaration | `wait(): inferred` |
| `src/decoration/scheduler.ts:L48` | `EpisodeScheduler` | MethodDeclaration | `play(scene: T): inferred` |
| `src/decoration/scheduler.ts:L54` | `EpisodeScheduler` | MethodDeclaration | `setPaused(paused: boolean): inferred` |
| `src/decoration/scheduler.ts:L60` | `EpisodeScheduler` | MethodDeclaration | `dispose(): inferred` |

### src/i18n.tsx

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `src/i18n.tsx:L3` | `<module>` | TypeAliasDeclaration | `Language = "en" \| "es"` |
| `src/i18n.tsx:L314` | `<module>` | TypeAliasDeclaration | `LanguageContextValue = { language: Language; setLanguage(language: Language): void; t(text: string): string; }` |
| `src/i18n.tsx:L316` | `<module>` | MethodSignature | `setLanguage(language: Language): void` |
| `src/i18n.tsx:L317` | `<module>` | MethodSignature | `t(text: string): string` |
| `src/i18n.tsx:L321` | `<module>` | FunctionDeclaration | `translate(text: string, language: Language): string` |
| `src/i18n.tsx:L336` | `<module>` | FunctionDeclaration | `LanguageProvider({ children }: { children: ReactNode }): inferred` |
| `src/i18n.tsx:L348` | `<module>` | FunctionDeclaration | `useLanguage(): LanguageContextValue` |

### vite.config.ts

| Location | Scope | Kind | Signature |
| --- | --- | --- | --- |
| `vite.config.ts:L13` | `<module>` | FunctionDeclaration | `incomingBody(req: IncomingMessage): ReadableStream<Uint8Array>` |
| `vite.config.ts:L16` | `incomingBody` | MethodDeclaration | `start(controller: inferred): inferred` |
| `vite.config.ts:L22` | `incomingBody` | MethodDeclaration | `pull(): inferred` |
| `vite.config.ts:L23` | `incomingBody` | MethodDeclaration | `cancel(): inferred` |
| `vite.config.ts:L27` | `<module>` | FunctionDeclaration | `localEditorial(): Plugin` |
| `vite.config.ts:L31` | `localEditorial` | MethodDeclaration | `configureServer(server: inferred): inferred` |

## Static-analysis limits

Imports express syntactic dependencies. A call target such as `object.method` is textual and unresolved: aliases, overloads, callbacks, inheritance, dynamic imports and branch guards can change actual execution. Computed targets are placeholders. Anonymous callbacks have no separate stable declaration identity. Scope labels are a syntactic aid and not globally unique symbol IDs. JSX/rendered DOM behavior, network effects, generated code, SQL execution and coverage require separate evidence. No resolved runtime call graph, behavioral completeness or execution result is claimed.
