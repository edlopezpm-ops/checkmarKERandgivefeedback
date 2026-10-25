# Workspace settings

**Settings** centralizes private sole-owner workspace limits, the default duration of new pieces and access to the existing device Environment controls. It is included in the hosted release; exact deployment and owner readback are recorded separately. It does not connect a provider, activate AI or publish content.

## Saved workspace controls

| Control | Initial value | Installed bounds and meaning |
| --- | --- | --- |
| Monthly planning budget | US$20 | US$0–20; an internal monthly planning amount, not an invoice cap. |
| Monthly processing allowance | US$10 | US$0–20; processing plus future AI allocation cannot exceed the total. New hosted processing admission uses this saved allowance. |
| Future AI API allocation | US$0 | US$0–20 within the total; a reservation for a future connection, not an enabled AI ledger, API key or entitlement. |
| Studio storage allowance | 2 GiB | 0–2 GiB, including originals, derivatives and pending reservations. |
| Default duration for new pieces | 20 seconds | Whole seconds from 5–60; existing recipes keep their saved duration. |

Dollar values are validated as integer cents by the server. The installed ceilings intentionally prevent an ordinary preference edit from silently expanding the owner's US$20 design or 2 GiB capacity. A larger capacity needs a reviewed architecture/configuration change. Processing and AI are allocations within the total; unused total budget is headroom rather than an automatic provider charge.

Edit and explicitly **Save settings**. Saved values belong to the sole owner and apply across devices. **Refresh status and keep my changes** reads current values without erasing the form; **Restore saved values** discards unsaved fields. Settings have their own revision check: a save made against an older revision is rejected without overwriting the newer values. Refresh the status, compare the saved values and explicitly confirm replacement, or restore the saved values. Unsaved form changes do not alter admission. Invalid input or a failed save leaves the last saved version effective.

Reducing processing or storage below existing usage does not delete originals, historical usage or saved jobs, and does not refund or cancel earlier admitted work. It stops new admission when the applicable allowance is exhausted. There is no automatic purge, capacity purchase or billing-provider update.

## Cost and service boundaries

The processing ledger uses UTC calendar months. Each newly admitted probe reserves five internal cents; a render reserves ten. Optional technical analysis reserves five per original/range/profile when its hosted tools have been verified and enabled. A complete exact render or cached analysis can be reused without a new reservation; an explicitly regenerated render is another attempt. Failed compute is not refunded. Local native processing makes no cloud-credit reservation.

These are conservative admission credits, not measured provider dollars. Cloudflare's actual Workers, D1, R2 and Container billing, shared-account usage and applicable taxes remain separate. Storage is a byte allowance, not a monthly price field. The US$20 total is an internal planning control and does not impose a Cloudflare account invoice hard cap.

The future AI allocation does not make a ChatGPT subscription an API allowance. No API provider, model, credentials, live inference, transcription or AI spend is enabled by saving it. A future connection must add its own explicit eligibility, consent, usage accounting and provider-aware admission contract before this reservation can govern requests.

## Device Environment

Settings also exposes the established Environment controls for interface language, decorative companions, pause, scene playback and optional local decorative assets. The header Environment entry remains available. These choices retain their existing browser/device persistence and are separate from server-saved workspace limits. Language changes interface copy only; it never translates saved material. Local decorative asset copy starts off and is removed when disabled or when signing out.

Originals, render history and source rights keep their existing protections. Settings is not an ownership, multi-user administration, publication, music licensing, retention/purge or secret-management surface. The contextual **help** entry covers these controls with numbered steps and screenshots in English and Spanish; the topic index also links to Access, Agents, Profile and Environment guidance.
