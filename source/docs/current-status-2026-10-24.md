# Current state and review backlog — 2026-10-24

This is the current handoff for another reviewer. Earlier design documents retain
their dated implementation checkpoints. The [full review repository](https://github.com/edlopezpm-ops/checkmarKERandgivefeedback)
contains the complete selected product source, architecture, flows, catalogs,
provenance and review prompt; private runtime data and credentials are excluded.

## Verified delivery

- The native Space classifier and campaign planner remain the product foundation.
  All five core files match native baseline
  `2535536183928c7d3e581617af0b03a525658ba4` in Git. They work without an agent;
  assistant tools call the same domain rules and preserve editable recipes,
  rights checks, revision checks, human review and approved export.
- The normal hosted assistant connection uses the registered private marKER App
  and OAuth. Login resumes the pending consent. Local bridge commands are
  development-only and are not a hosted-user prerequisite.
- Actual OpenAI connection returned successfully to ChatGPT. The connected
  catalog exposed six read and eight write/production tools, with DELETE absent.
  Real `marker_get_profile` and bounded product search calls succeeded. No real
  business write or complete assistant campaign has been exercised yet.
- The last verified Worker is `d5f43234-74b2-4c45-a850-4f1dab75620c`, with
  integration source `f9478e66f4c5798b417f7b25b462d8dd0d673295` plus the twelve
  existing demo paths now being committed. The `0011` migration is applied.
  Verification at 2026-10-25 02:34 UTC recorded five anonymous endpoint checks
  and 185 exact hosted assets. This closure adds documentation and commits those
  same demo bytes; it does not perform another deployment.
- Focused OAuth/SDK/policy tests and real synthetic-browser IPv4/IPv6 callbacks
  passed. For this Git closure, the frontend/server build and original-logo
  integrity check passed again. These checks do not establish human acceptance,
  creative quality, universal host compatibility or physical-device behavior.
- The public [55-second demo](https://marker.aekr.io/demo/) includes 1080p/4K,
  Spanish captions and an Environment/Settings link. Its two immutable media
  routes support bounded byte-range streaming. It uses fictional local data.

## Remaining work, in priority order

| Priority | Pending outcome | Evidence needed |
| --- | --- | --- |
| 1 | Complete one actual campaign from the connected assistant. | An explicitly requested editable save visible after reload; native classification/planning parity; a real render/job; owner review and approval in marKER; export of that exact revision. Verify conflicts, retries and private download behavior. Successful read calls alone do not prove these steps. |
| 2 | Verify the intended Dot/voice/phone experience. | Actual installed-plugin discovery and a requested read/draft action on each selected host. Exercise physical iPhone/Safari and Android/Chrome, fresh login, cancellation, interruption and recovery. Each surface needs its own evidence. |
| 3 | Finish connection lifecycle and host compatibility checks. | Real refresh, disconnect/revocation, reconnect and scope upgrade; independent host callback checks; private-file attachment when supported, otherwise authenticated download. Evaluate bounded CIMD/protocol durability and structured tool outputs without breaking approved clients. |
| 4 | Apply the requested Torres del Paine + sun icon to the owning ChatGPT App. | The existing personal App management surface exposed name/description editing but no logo control. The original symbol is preserved at `public/brand/marker-tab-v1.svg`; the App icon is still unchanged. Use a supported owning-App asset control when available. |
| 5 | Measure the native product's time-saving and media quality. | The planned ten-piece pilot against a manual baseline, actual correction counts and active human time. Hosted technical analysis remains disabled until its real toolchain is verified. Transcription, subtitles, semantic selection and other media improvements remain separate work. |
| 6 | Prepare later public readiness and operational confidence. | Provider-required submission/reviewer arrangements and accurate identity, policies, support and listing assets; focused security/accessibility review, actual cost/limit comparison and recovery rehearsal. Provisional legal notices remain provisional. Existing backup-restore migration checks do not establish a complete recovery rehearsal. |

The current product intentionally retains a single authenticated owner and
persisted tenant. New-user onboarding, multi-tenant SaaS, public plugin submission,
connected social publishing, scheduling, live metrics and paid activation are
future decisions. A public listing would not give other users access to this
private workspace. Embedded inference inside marKER also has a separate provider
admission/entitlement contract; the working external MCP connection does not
depend on completing that separate integration.

## Questions for independent AI review

1. Which concrete bugs or missing checks could prevent a normal OAuth connection
   or a durable, revision-safe campaign action? Trace findings to exact source.
2. Does the UI minimize effort for a solo marketer while retaining the native
   classification and campaign route when all optional agents are offline?
3. Do tools reuse the actual backend rules, isolate the owner/tenant, preserve
   source provenance and clearly report saved, failed, stale and uncertain work?
4. What is the smallest useful next increment for one real assistant campaign
   and then Dot/phone, without replacing the deterministic engine or adding SaaS?
5. Separate observed defects, untested paths, design proposals and provider-owned
   prerequisites. Do not treat a planned capability as already implemented.

Use the [connector contract](mcp-connector.md), [integration design](assistant-integration-design-2026-10-24.md),
[native planner](studio-planner.md), [hosted Studio](hosted-studio.md) and
[profile/data policies](profile-and-data.md) for the corresponding boundaries.
