# marKER — check and give feedback

Public, source-backed technical dossier for reviewing **marKER** with another AI model without granting access to the private application repository. Snapshot: **2026-10-24**, source `main` at `1f9415ee19e1e6ed175df6ef8aac8edc7182c9e9`.

Start with [00-START-HERE](00-START-HERE.md), then read the [single complete dossier](marKER-FULL-DOSSIER.md). For a smaller model context, use [AI-QUICK-CONTEXT](AI-QUICK-CONTEXT.md). The [AI analysis prompt](AI_ANALYSIS_PROMPT.md) asks for evidence-based feedback and bounded change proposals. The combined dossier repeats the chapters for convenient ingestion; it is not independent evidence.

The package explains the current codebase, frontend, backend, authentication, data structures, APIs, media processor, deterministic campaign planner, Settings, animation, failure paths and operations. Mermaid diagrams identify functional nodes, state boundaries and external effects. The [database reference](database/README.md), [source/test/dependency reference](10-source-map-tests-and-dependencies.md) and [module index](code-flow/05-module-symbol-index.md) provide structural detail and source locations.

marKER is a private console for one owner. Its manual editorial workflow and separate media Studio coexist. The hosted entry uses Cloudflare Workers, D1, private R2 and a managed-container FFmpeg processor; local development uses loopback APIs and local files/SQLite. Rule-based assembly is implemented. Live AI generation, connected social publishing, advertising activation and live social metrics are not implemented. Technical analysis has a local implementation, but its hosted toolchain pin is deliberately disabled. A submitted interest request for an AI connection is not provider admission.

This repository publishes descriptions and structural inventories. It contains no complete application source, private configuration values, credentials, owner media or business records. Source pointers refer to the private snapshot and can be matched by its owner; a reviewer can analyze this dossier independently but cannot claim to have audited unavailable code. Facts about code capability, configured routing, actual runtime execution and human acceptance are labeled separately. Product tests, deployment, authenticated flows and restoration were not rerun for this documentary publication.

| Reading path | Contents |
| --- | --- |
| [Architecture](01-architecture-and-stack.md) | Runtime topology, node ownership, dependency and trust boundaries. |
| [Data](02-data-model-and-transactions.md) | Editorial/Studio entities, revision protocols, quotas and persistence. |
| [Product](03-product-and-user-workflows.md) | Current modules, user sequences, review and outcomes. |
| [Frontend](04-frontend-and-interaction.md) | React state, navigation, forms, recovery, language and help. |
| [Backend and access](05-backend-api-and-access.md) | Authentication, routes, validation and error contracts. |
| [Processing](06-studio-processing-and-jobs.md) | Upload, probing, rendering, jobs and effect custody. |
| [Integrations](07-integrations-and-capability-status.md) | Implemented, inactive and proposed capabilities. |
| [Operations](08-operations-quality-and-limits.md) | Local/hosted differences, quality evidence, recovery and limits. |
| [Feedback guide](09-review-guide-and-open-decisions.md) | What to preserve, review questions and implementable feedback format. |
| [Catalogs](10-source-map-tests-and-dependencies.md) | Exact source, symbols, API and test inventories, locked dependencies. |
| [Database](11-database-and-catalog-reference.md) | Empty-schema reconstruction, fields, keys and structural limitations. |
| [Code flow](code-flow/README.md) | Named function/node traces and troubleshooting. |

Integrity: [CURRENT-STATE.json](CURRENT-STATE.json), [source-snapshot-manifest.json](source-snapshot-manifest.json), [PACKAGE-MANIFEST.json](PACKAGE-MANIFEST.json), [PACKAGE-VERIFICATION.json](PACKAGE-VERIFICATION.json), [SHA256SUMS.txt](SHA256SUMS.txt). See [publication scope](NOTICE.md).
