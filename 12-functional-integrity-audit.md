# 12 — Functional-integrity audit, 26 October 2026

Snapshot `77bbedaccc6bc410364cef16fba1ed88b1eaf5e1`, clean source, full declared product inventory. **Verdict: FAIL because F01 is a minor confirmed interface-language failure.** No evaluator tampering, improper test special-casing or production simulation presented as real execution was observed within the reviewed scope. Authorship and intent are undetermined.

This chapter introduces the published, sanitized audit derivative. The [REPORT](audit/2026-10-26/REPORT.md) is the detailed verdict; [MATRIX](audit/2026-10-26/MATRIX.json) records contracts, weights and decisions; [SCORECARD](audit/2026-10-26/SCORECARD.json) records exact arithmetic; [FINDINGS](audit/2026-10-26/FINDINGS.json) records triggers, evidence, alternatives and follow-up. Reproductions and sanitized outputs are under [repro/](audit/2026-10-26/repro/) and [evidence/](audit/2026-10-26/evidence/). Publication excludes private governance, owner data, credential stores and secret-bearing metadata; it does not assert byte identity to every private operational artifact.

| Metric | Exact weights | Display |
| --- | --- | --- |
| Demonstrated compliance D | P/W =34/60 | 56.67% |
| Decision coverage C | (P+F)/W =37/60 | 61.67% |
| Confirmed weighted failure | F/W =3/60 | 5.00% |
| Weighted unknown | U/W =23/60 | 38.33% |

W=P+F+U=60=34+3+23. Ten capabilities PASS, one FAIL and five UNKNOWN. These policy weights are not scientific scores, defect prevalence or a probability of deception. Unknowns remain in the denominator. Weights were proposed before result review; the physical freeze was saved after a subsequently refuted static legacy-route observation and before executed checks or confirmed frontend findings. No result-driven weight change occurred.

| Finding | Evidence state | Meaning |
| --- | --- | --- |
| F01 · CONTRACT_FAILURE · minor | CONFIRMED; C12 FAIL | English Studio displays “Space cambió. Recarga antes de guardar.” after a correct stale-revision rejection. The draft and CAS protection remain intact. |
| F02 · SPEC_AMBIGUITY | SUSPECTED; C11 UNKNOWN | ACK HTTP 200 with false/empty JSON leaves active/applied state. Without the authoritative central ACK schema, that field cannot be treated as a proved contractual rejection. No confirmed false success or authorization bypass. |
| F03 · WEAK_TEST · minor | CONFIRMED | Tests need generated processor modules and a synthetic private-file sentinel; the suite does not prepare both autonomously. |
| F04 · WEAK_TEST · minor | CONFIRMED | A streaming mutation can hang a test, and cleanup can obscure a persistence assertion. External bounded oracles detected the directed defects. |
| F05 · documentary drift | Observation | Earlier editorial creation wording conflicts with current earlier-record guidance. The legacy API and native Studio path work; a disconnected main implementation was not demonstrated. |

F01 follows [Studio API error handling](source/src/console/Studio.tsx) through [ErrorNotice](source/src/console/ErrorNotice.tsx); the [hosted adapter](source/server/studio-hosted.ts) has the corresponding fixed server message. Reproduce with two fresh local connections: load a campaign form, mutate Studio independently, then submit the stale form in EN. Correct a future version through stable error codes and verify new EN/ES failure cases without weakening validation.

The audit's prepared full suite passed **333/333, no skips**. Frontend/server types, production build, immutable-logo checks and local Worker dry run also passed. Independent checks exercised real native FFmpeg export and full decode; original/hash preservation and restart persistence; local MCP save/replay/revocation; SQL, own-data export and synthetic erasure failure/retry; hosted admission with SQLite and synthetic services; browser language/help/cache/animation; and real demo seeking/ranges. Three selective negative controls and baseline restoration tested verifier sensitivity. This publication does not run the product again.

The remaining 23 unknown weight belongs to C05 hosted processing/admission, C06 real authentication services, C07 external erasure, C09 real bridge inference and C11 central Analytics contract/effects. Synthetic transport and local SQL tests cannot establish the corresponding service's real effect. No production writes, provider inference, deployment, fresh hosted readback, physical-device UAT or human acceptance occurred in this audit.

Review current [policy/profile/data contracts](source/docs/profile-and-data.md), [deliberate notices and own-data release](source/docs/POLICY_RIGHTS_RELEASE_2026-10-25.md), [policy API](source/server/policy.ts), [own-data export](source/server/privacy-data.ts), [Analytics contract](source/docs/analytics-integration.md), [relay](source/server/analytics.ts) and [dated Analytics publication](source/docs/ANALYTICS_RELEASE_2026-10-25.md). Viewing Terms is separate from deliberate acknowledgement; optional preferences and data rights are separate. The dated publication records central collection paused; the audit did not recheck that live state.

Next work is defined in [PENDING-REPORT](PENDING-REPORT.md). A fix requires a new snapshot and independent examples; fixing a later version cannot make the original snapshot correct. The current source projection and audit seals preserve what was actually evaluated.
