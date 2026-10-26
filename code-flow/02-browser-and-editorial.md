# Browser and editorial flow

Current source: 26 October 2026, `77bbedac`. [Console](../source/src/console/Console.tsx) → [client](../source/src/core/client.ts) → [shared API](../source/server/api.ts) → [domain](../source/src/core/domain.ts) → repository CAS → fresh snapshot. The server owns relationships, slot conflicts, deletion guards and explicit outcomes. A browser message does not override a rejected command.

An OAuth handoff supplies a short-lived correlation handle. [mcp-resume](../source/src/console/mcp-resume.ts) removes that parameter while preserving other URL/history state and consumes it before authenticated server resume. The server still validates the transaction and consent.

Studio has separate material/campaign/recipe state and [planner](../source/src/console/StudioPlanner.tsx). Current new-piece creation is Studio; earlier editorial source/campaign/post records remain inspectable. Profile and Settings use independent revisions. The old creation wording is F05 documentary drift, not a confirmed disconnected main route.

Missing service declarations → [PolicyGate](../source/src/console/PolicyGate.tsx) → deliberate versioned submit → [policy backend](../source/server/policy.ts) → receipt → refreshed access. Opening a notice cannot record acceptance. Privacy → [PrivacyDownload](../source/src/console/PrivacyDownload.tsx) → bounded own-data pages → declared-category JSON, under its separate rights contract.

Settings → [AnalyticsSettings](../source/src/console/AnalyticsSettings.tsx) → owner-scoped [relay](../source/server/analytics.ts). Optional purposes and declared interests are independent of service declarations and native campaign work.

The header EN/ES control changes interface text without translating saved material. **F01:** Studio's raw server-error path → [ErrorNotice](../source/src/console/ErrorNotice.tsx) leaves a Spanish conflict alert in EN. CAS and the unsaved form remain correct. [Evidence and reproduction](../audit/2026-10-26/FINDINGS.json); the publication does not rerun the browser.
