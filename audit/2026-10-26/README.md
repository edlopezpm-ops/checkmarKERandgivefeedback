# Functional integrity audit — public projection

Read [REPORT.md](REPORT.md), [MATRIX.json](MATRIX.json), [SCORECARD.json](SCORECARD.json), [FINDINGS.json](FINDINGS.json), [refutation.json](refutation.json) and the [original method](METHOD.md).

This package preserves FAIL/UNKNOWN and evidence boundaries. A passing suite is not product acceptance. F01 is the minor confirmed language defect; F02 is specification uncertainty, not a confirmed false success. The full current public product is [source/](../../source/).

Evidence contains only synthetic audit results, selected logs, screenshots and fictional media. Private governance, credential files or digests, owner data, runtime databases, CLI profiles, dependency installations and build bundles are omitted. Local execution paths are normalized. Original hashes retained in JSON refer to original local logs; current derivative hashes are recorded in MANIFEST.json and updated log fields.

For score replay: `python audit/2026-10-26/repro/calculate_score.py` from repository root. Behavioral drivers are portable adaptations and are not rerun during publication. Use a disposable clone/workspace and synthetic stores. Install source dependencies separately, use Node 24+ with type stripping, provide FFmpeg/ffprobe on PATH or through MARKER_FFMPEG and MARKER_FFPROBE, and use a fresh BACKEND_AUDIT_RUN suffix for backend replays. Run `npm run build` inside source/ before frontend-independent.mjs because it inspects source/dist/assets. Native/hosted ledger drivers run in that order because the latter reuses the native synthetic MP4. Browser reproduction requires its own local browser tooling.

The product keeps its own optional Font/.local media prerequisites documented under source/docs. Missing hosted credentials do not authorize production or provider calls. Do not treat an unexecuted portable adaptation as a fresh PASS. All included execution evidence is qualified in the report.
