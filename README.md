# marKER — full source and functional-integrity review

Current review snapshot: **26 October 2026**, source commit `77bbedaccc6bc410364cef16fba1ed88b1eaf5e1`, with **368 tracked product files** and no source working-tree overlay. [source/](source/) contains the current frontend, backend, tests, migrations, build configuration, product documentation and public assets. The [manifest](source-snapshot-manifest.json) binds the projected bytes.

**Audit verdict: FAIL, for one confirmed minor UI defect.** Studio displays a fixed Spanish conflict message with the interface set to English. Two additional findings concern test reliability. The Analytics ACK concern remains suspected specification ambiguity; it is not a confirmed false success. No evaluator tampering or improper fixture adaptation was observed within the reviewed scope. Authorship and intent are not determined.

| Entry | Purpose |
| --- | --- |
| [Start here](00-START-HERE.md) | Reading order, snapshot and evidence contract. |
| [Functional-integrity audit](12-functional-integrity-audit.md) | Verdict, score, findings, reproductions and remaining evidence. |
| [Audit report](audit/2026-10-26/REPORT.md) | Published audit conclusions and execution limits. |
| [Current combined dossier](marKER-FULL-DOSSIER.md) | Current curated chapters and navigation. |
| [Quick context](AI-QUICK-CONTEXT.md) | Product and trust boundaries. |
| [External-review prompt](AI_ANALYSIS_PROMPT.md) | Reusable instructions for a fresh review of this snapshot. |
| [Pending work](PENDING-REPORT.md) | Corrections, unresolved contracts and real-service evidence. |
| [Source inventory](inventories/source-paths.md) | Included paths, sizes and hashes. |
| [Code flow](code-flow/README.md) | Entrypoints, storage, media, UI and connector navigation. |
| [Data catalogs](11-database-and-catalog-reference.md) | Empty schema reconstruction and limitations. |

The frozen 16-capability matrix has W=60, P=34, F=3 and U=23. Demonstrated compliance D is **56.67%**; decision coverage C is **61.67%**; weighted unknown is **38.33%**. These are capability weights, not test-pass percentages or probabilities of deception. UNKNOWN remains in the denominator. The [matrix](audit/2026-10-26/MATRIX.json) and [scorecard](audit/2026-10-26/SCORECARD.json) preserve the calculation.

The audit exercised native local preparation, real FFmpeg output, persistence after restart, local MCP writes/replay/revocation, schema and failure paths, browser language/help/cache/animation, and real demo seeking/ranges. Its prepared full suite passed **333/333, with no skips**; build/types/logo checks and a local Worker dry run passed. Those executions belong to the audit. Publishing this review package does not rerun them or verify a current deployment, real provider, target assistant, physical phone or human acceptance.

marKER remains a private single-operator content-preparation application. Space classification and deterministic planning work without an AI connection. A human reviews and approves the exact result before export. Export does not publish to a social account. Current source includes versioned service-notice acknowledgements, bounded own-data export and the optional central Analytics relay; central production collection is recorded as paused in its dated source receipt.

The [24 October dossier](marKER-FULL-DOSSIER-2026-10-24.md) is retained as historical material at its own source/evidence cut. It does not describe the current `source/` projection. Dated product release receipts also retain their own scope. Use [CURRENT-STATE.json](CURRENT-STATE.json) and [SNAPSHOT-2026-10-26.md](SNAPSHOT-2026-10-26.md) for this publication.

Private agent governance, owner records, account/session stores, actual credentials/environment values and dependency installations are excluded. Published audit material is a sanitized derivative; reproduction paths may be relocated, with exclusions stated in the audit. Public source access does not make the registered assistant plugin public or admit additional users. [Integrity verification](PACKAGE-VERIFICATION.json), [package manifest](PACKAGE-MANIFEST.json) and [SHA-256 list](SHA256SUMS.txt) describe the package, not security certification.
