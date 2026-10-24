# 11 — Database and catalog reference

The current default Worker routes through native owner authentication, D1, private object storage and the Studio processor. Local development has a separate loopback JSON editorial file and a Studio SQLite database. Supabase/PostgreSQL remains a distinct prepared alternative. These storage paths have different schemas and must not be merged into a fictional single database.

## Effective D1 structure

[Complete D1 reference](database/d1-reference.md), [schema-only DDL](database/d1-schema.sql) and [JSON catalog](database/d1-catalog.json) cover all five tracked D1 migrations, 15 tables, 82 columns, eight explicit indexes and zero triggers. Implicit primary-key/unique indexes are also recorded where SQLite reports them.

| Tables | Ownership / meaning |
| --- | --- |
| `marker_auth_limits` | Hashed limiter key/ticket, windows, counts and last-request time. |
| `marker_auth_challenges` | Hashed challenge/owner/code, creation/expiry, attempt count and consumed marker. |
| `marker_auth_sessions` | Hashed session/owner, creation/expiry and last seen. |
| `marker_workspace` | Singleton legacy editorial JSON aggregate and independent revision; SQL cap is 1,048,576 bytes and valid JSON. |
| `marker_studio_meta` | Singleton Studio revision and write token for conditional multi-table state commits. |
| `marker_studio_assets` | Immutable original identity/hash/kind/size, unique object storage key and technical JSON document. |
| `marker_studio_materials` | Editable library record, optional original reference, content version and JSON document. |
| `marker_studio_campaigns` | Studio campaign and product reference plus JSON document. |
| `marker_studio_variants` | Campaign-bound recipe revision and JSON document; foreign key restricts campaign deletion. |
| `marker_studio_uploads` | Upload lifecycle/document and claim lease. Partial unique index permits one uploading record. |
| `marker_studio_jobs` | Variant/recipe-bound render or text-approval history, job status/document, claim lease and reservation. Partial unique index permits one queued/running render. |
| `marker_studio_limits` | Stored/reserved byte counters, active upload/compute tokens and compute lease. |
| `marker_studio_compute` | Month-keyed used processing cents and last settlement token. |
| `marker_studio_analysis` | Original/range/profile/tool-version analysis record, lifecycle/document, lease and storage/metadata reservation. Partial unique cache excludes failed records. |
| `marker_studio_settings` | Singleton strict revision and internal total/processing/future-AI/storage/default-duration caps. Processing plus AI allocation cannot exceed total. |

The catalog retains every column, default, primary-key ordinal, declared not-null flag, foreign-key action, expression/partial index and CHECK clause. A relational catalog does not expand the JSON documents: those fields are described by `Workspace`, `StudioState`, `StudioAsset`, recipe/planner/analysis/job/settings types in the [symbol reference](code-flow/05-module-symbol-index.md).

The original-to-material, campaign-to-variant, variant-to-job and asset-to-analysis relationships have explicit foreign keys where shown in DDL. Product references live in a separate editorial JSON aggregate and therefore require application validation/CAS; they are not secretly SQL foreign keys. Historical receipts can retain source snapshots after editable records change. A proposed migration must preserve those references and exact-recipe approval semantics.

Migration comments include historical prepared-only wording. This structural extraction does not use those comments as current deployment status. It makes no new claim about migrations applied remotely or hosted toolchain compatibility. Hosted technical analysis remains separately disabled until the explicit native version contract is satisfied.

## Loopback persistence

The legacy `LocalRepository` reads/writes a JSON workspace with compare-and-swap and atomic rename; it is not an SQLite table (`server/local.ts:L11-L54`). Studio initializes a distinct database from static SQL (`server/studio-local.ts:L106-L120`). Its [full reference](database/local-studio-reference.md), [DDL](database/local-studio-schema.sql) and [JSON catalog](database/local-studio-catalog.json) contain 10 tables, 33 columns, three explicit indexes and zero triggers.

Local `studio_meta`, `studio_assets`, `studio_materials`, `studio_campaigns`, `studio_variants`, `studio_uploads`, `studio_jobs`, `studio_analysis` and `studio_settings` perform analogous adapter roles with different relational constraints/documents. `studio_asset_files` maps original IDs to local storage keys. Filesystem originals, upload parts, renders, thumbnails and fonts are outside the SQL catalog. No such existing files or database rows were read for this dossier.

The local adapter uses serialized operations and application-level guards in addition to SQL. It is not a hosted multi-user database substitute. The SQL shape alone does not establish equivalent concurrency, permission or recovery behavior across adapters.

## Inactive alternative

[Supabase reference](database/supabase-reference.md) summarizes two PostgreSQL tables, two security-definer functions and one owner-read RLS policy from the prepared migration. It excludes wholesale function bodies and actual owner configuration. The helper is callable code but is not the default native Worker path. Its 4,500,000-byte JSON limit differs from D1's 1 MiB editorial document limit.

## API and structural catalogs

- [30 curated method/path contracts](inventories/routes.md), including two explicitly inactive compatibility endpoints; [JSON](inventories/routes.json).
- [91 static API literal/regex occurrences](inventories/route-occurrences.json), including client/test/guard references. Occurrences are not an endpoint count.
- [Every tracked source path](inventories/source-paths.md) and [hash manifest](source-snapshot-manifest.json).
- [All test declarations](inventories/test-index.md) and [dependency versions](inventories/dependencies.md).
- [All indexed modules and signatures](code-flow/05-module-symbol-index.md); [complete AST](inventories/ast-index.json).

## Reconstruction and limits

All SQL reconstruction used fresh in-memory SQLite databases. Source migration seed statements executed there only; exported DDL contains no rows/INSERTs. Schema-only replay reproduced all non-internal objects, and integrity/foreign-key checks passed. The source manifest binds the exact committed files; generated catalogs bind structure, not a production backup or live query result. These checks do not demonstrate live migration application, resource identity, runtime data validity, platform billing caps, permissions, performance, recovery or human acceptance.
