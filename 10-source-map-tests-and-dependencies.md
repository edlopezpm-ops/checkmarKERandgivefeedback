# 10 — Source map, tests and dependencies

The snapshot is pinned to product commit `1f9415ee19e1e6ed175df6ef8aac8edc7182c9e9`. It inventories every one of the 203 tracked paths: 8,869,800 committed bytes, 102 UTF-8 text paths and 31,504 text lines. These descriptive counts include maintained documentation, the lockfile, generated platform declarations, tests and assets. They are not complexity or test-coverage scores.

[Every tracked path](inventories/source-paths.md) and the [source snapshot manifest](source-snapshot-manifest.json) provide Git blob IDs, committed SHA-256/size/line counts and separate clean-checkout SHA-256/size/line counts. Git-normalized blob bytes can differ from Windows CRLF checkout bytes; both are named explicitly. Asset entries expose metadata and hashes, not pixels, fonts or embedded content. The source code itself is not distributed.

## Module families

| Paths | Responsibility |
| --- | --- |
| `src/App.tsx`, `src/main.tsx`, `src/i18n.tsx` | Application/session bootstrap, navigation/settings state, React mounting and language context. |
| `src/console/` | Legacy manual editorial UI, current Space/Studio Campaigns, deterministic planner, technical analysis, settings, local text simulation and bilingual help. |
| `src/core/` | Shared editorial/Studio domain, validation, persistence contracts, recipe and analysis types, deterministic proposal rules and settings constraints. |
| `server/api.ts`, `server/d1.ts`, `server/local.ts` | Shared legacy command HTTP boundary and effective D1 / loopback JSON repositories. |
| `server/native-auth.js`, `server/native-auth-store.js` | Native owner-only code/challenge/session/rate-limit system and SQL store. |
| `server/studio-local.ts`, `server/studio-hosted.ts` | Distinct local/hosted Studio adapters implementing state, uploads, jobs, analysis and settings. |
| `server/studio-render.ts`, `server/studio-analysis.ts`, `server/studio-processor.ts`, `processor/runner.mjs` | Native bounded media/analysis algorithms and hosted durable/container processing bridge. |
| `server/entry.ts`, `server/worker.ts` | Worker entry, static asset/native API routing and scheduled auth cleanup. |
| `server/supabase.ts`, `migrations/0001_editorial.sql` | Inactive prepared PostgreSQL/Auth alternative. |
| `src/decoration/` | Optional Canvas character assets, scene choreography, renderer and scheduler. |
| `migrations-d1/` | Five ordered static D1 structural migrations. |
| `tests/` | 19 tracked test files with 144 syntactic test/subtest declarations. |
| `tools/`, `vite.config.ts`, `tsconfig*.json`, `wrangler.jsonc` | Asset preparation/verification, local HTTP boundary, compilation and hosted configuration. Actual deployment identifiers are not copied into this dossier. |

The [module/symbol index](code-flow/05-module-symbol-index.md) links product callable/type declarations to source lines. The complete [AST JSON](inventories/ast-index.json) records 62 tracked TS/TSX/JS/MJS modules, 10,530 declaration/field records, 278 imports/re-exports and 9,427 call/new-expression sites using TypeScript 5.9.3. All 62 files parsed with zero syntax diagnostics. Generated platform declarations dominate the symbol count; this does not mean the application contains 10,530 business functions.

This is syntactic indexing. Calls are unresolved textual targets; initializer values, call arguments and executable bodies are excluded. Inferred return types are marked `inferred`, dynamic targets use placeholders, and anonymous callbacks are not assigned invented globally unique identities. The index is not a resolved runtime call graph or behavioral proof.

## Tests and evidence boundaries

The [test index](inventories/test-index.md) lists every declared name and location, including nested `t.test` declarations; [JSON](inventories/test-declarations.json) supports machine analysis. Intended areas include domain transitions, CAS, auth/rate limits, SQL-backed persistence, origin/payload guards, resumable uploads, planner eligibility/reuse, technical analysis, media rendering, processing jobs, settings, help, assets and motion.

No product test, build, browser workflow, hosted migration or deployment was rerun for this documentation-only task. Test names describe intended contracts, not freshly demonstrated results. Existing product verification and human acceptance must remain separate from this static inventory. A future proposed change should identify affected declarations, test cases and additional evidence needed for its specific behavior.

## Dependencies and commands

[Dependency reference](inventories/dependencies.md) lists the eight direct dependencies and all 136 lockfile package entries with exact versions, dev/optional classification and license labels when supplied. [JSON](inventories/dependencies.json) additionally preserves integrity hashes and package scripts. The application declares only React and React DOM as runtime dependencies; TypeScript/Vite/Wrangler and type packages are development dependencies. Native FFmpeg/FFprobe and platform bindings are separate operational requirements, not npm dependencies inferred from that count.

The documentary tools use Python's stdlib, Git and the already installed product TypeScript parser. No product dependency was added. Reproduction instructions are in [tools/README.md](tools/README.md).

## Navigating without source access

Start with architecture/workflow chapters, then select the relevant domain/adapter symbol and its source line. Use [curated routes](inventories/routes.md) for accepted method/path contracts, [schema catalogs](database/README.md) for relational constraints and declared types for JSON fields. Every path can be checked against the frozen manifest. The package intentionally cannot prove unobserved runtime behavior or provide line-by-line implementation editing without the private repository.
