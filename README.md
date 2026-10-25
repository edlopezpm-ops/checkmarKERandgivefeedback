# marKER — full current-source review

This public repository contains the complete reviewable marKER product snapshot: **346 source/assets/configuration/test files**, plus an architectural dossier, data catalogs, source navigation and an external-review prompt. Start with [the reading contract](00-START-HERE.md) and [AI_ANALYSIS_PROMPT.md](AI_ANALYSIS_PROMPT.md).

**Snapshot:** 2026-10-24, source base `f9478e66f4c5798b417f7b25b462d8dd0d673295`, with **12 explicitly recorded working-tree paths**. The [manifest](source-snapshot-manifest.json) identifies the exact captured bytes; the base commit alone does not identify uncommitted demo changes. The source repository remains privately maintained; this separately authorized projection is public.

| Review entry | Contents |
| --- | --- |
| [Full implementation](source/) | Frontend, backend, native domain/planner/classifier, Agents bridge, authenticated MCP connector, reproducible host package, tests, tools, processor, migrations, config, docs and public assets. |
| [One-file dossier](marKER-FULL-DOSSIER.md) | Current architecture, behavior, trust boundaries, operations and review questions. |
| [Quick context](AI-QUICK-CONTEXT.md) | Concise orientation before reading the code. |
| [Source inventory](inventories/source-paths.md) | Every included path, byte size and SHA-256. |
| [Code flow](code-flow/README.md) | Request/auth/storage, UI/editorial, media, Agents/MCP and source-symbol navigation. |
| [Data catalog](11-database-and-catalog-reference.md) | All included D1 migrations replayed into an empty SQLite schema; local Studio schema separately reconstructed. |
| [Evidence and limits](08-operations-quality-and-limits.md) | Fresh package checks versus root-reported product checks, deployment and actual host/device gaps. |

marKER's native Space → classify → prepare editable campaign → render → review/approve → export flow works without an AI connection. Optional local Agents and the external MCP adapter reuse that foundation. An export is not social publication. The [hosted MCP release is now technically verified](DEPLOYMENT-STATUS.md): migrations 0010/0011 remain applied and Worker `d5f43234-74b2-4c45-a850-4f1dab75620c` serves production at 100%. Real owner OAuth returned to ChatGPT, its Connect action disappeared, and its catalog exposes fourteen tools (six Read and eight Write), with delete absent. Two actual connected reads—profile and a bounded product search—also pass. Business writes, a complete assistant-driven campaign, Dot conversation and physical-phone behavior remain unverified.

Public demo: [watch](https://marker.aekr.io/demo/); both original public MP4s, poster, captions and player are included in [source/public/demo/](source/public/demo/), with [metadata/URLs/hashes](inventories/public-media.json). Original branding and font license files are preserved.

Private governance/evidence, runtime owner data, account stores, actual secret/environment files, dependency installations and generated outputs are excluded. Blank example configuration and public instance/site identifiers remain in the source; no live credential value, credential-store digest or private App binding is published. The served installation CTA is authorized public configuration; it does not make the plugin audience public. See [NOTICE.md](NOTICE.md).

Español: este repositorio permite revisar el código completo y sus flujos actuales. Las pruebas locales, el despliegue, la conexión real en Dot y la aceptación humana se distinguen expresamente.

Integrity: [source snapshot](source-snapshot-manifest.json), [current state](CURRENT-STATE.json), [package manifest](PACKAGE-MANIFEST.json), [verification](PACKAGE-VERIFICATION.json), [SHA-256 list](SHA256SUMS.txt).
