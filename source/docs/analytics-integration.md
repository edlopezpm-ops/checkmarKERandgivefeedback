# Central Analytics integration

Hosted code and compatible migration were subsequently published under the same
HOC scope: [dated operational receipt](ANALYTICS_RELEASE_2026-10-25.md). Central
production collection remains paused; code publication does not supply optional
permissions or enable an external recipient. The prepared-source statements
below retain their original increment's boundary.

Prepared and technically verified on 2026-10-25. This source increment is not a
deployment or commercial activation. The central console is
[AEKR Analytics](https://aekr.io/analytics); marKER keeps native campaign creation,
planning, review and execution. It does not maintain a competing consent,
buyer, delivery or revenue ledger.

The owner's monetization brief and subsequent PROMPT 02 authorize this scoped
implementation and replace prior internal discovery-only, freeze and
no-instrumentation limitations for it. They do not amend prior user commitments,
grant historical consent, sign vendor contracts or authorize new expenditure.

## Real source and data boundary

The operator is an individual acting under the personal AEKR project name in
Chile, not a verified incorporated company. The current application has one
persisted owner and one tenant. Public landing/demo/policy visitors are distinct
from that operator; neither visitors nor a hypothetical SaaS population are
counted as registered marKER users. Actual traffic and target countries remain
unknown. No existing private content or historical account data is backfilled.

`marker-owner-production` identifies only deliberately declared owner interests.
The sole emitted event is `commercial_interest_selected`, with one closed
category and a separately granted `onsite_personalized_ads` permission. Space,
campaigns, messages, lists, media, provider results and API-derived material have
no automatic capture path. A browser cannot submit a provider/provenance field,
URL, email, tenant, free text, accepted lead, conversion, sale or payment.

The private Settings screen displays the central connection, desired and
confirmed configuration versions, expiry, separate optional purposes and
authorized audience references/counts. It links to the central operator console.
An analytics permission cannot enable the commercial-interest event. Named
recipient purposes require a currently enabled, explicitly selected recipient.
GPC blocks the covered advertising purposes while analytics remains separate.

## Wire contract and trust

The existing server owner authentication and immutable tenant gate protect
`/api/analytics`, `/api/analytics/preferences`, `/api/analytics/events` and
`/api/analytics/audiences`. Preference access is separate from acceptance of new
service Terms. Mutation requires the same origin and `X-Marker-Auth: 1`.

The relay uses only `https://aekr.io/api/collection/` and a source-specific
server secret `MARKER_ANALYTICS_TOKEN`. There is no caller-selected URL or
destination. Redirects are rejected, requests have a 2.5-second deadline and
responses are bounded to 32 KiB. Missing credentials cause no central request,
identifier or event. Invalid, expired, wrong-source or wrong-environment
configuration disables optional operation. The producer accepts a maximum
five-minute configuration and refetches before every event or permission grant.
The central backend must independently enforce its current version and pause.

The server derives a source-scoped HMAC subject from its authenticated tenant
and user, using its existing auth secret. This is a pseudonymous identifier,
not anonymous data. Neither email nor the raw tenant/user IDs are forwarded.
Rotation of the auth secret changes the pseudonym; perform central rights
reconciliation before such a rotation after activation.

| Central endpoint | marKER use |
| --- | --- |
| `GET config?source_id=marker-owner-production` | Current finite source policy |
| `POST ack` | Confirm the locally applied version |
| `GET preferences?subject_ref=…` | Read this source/subject's central preferences |
| `POST preferences` | Explicit purpose-specific grant, denial or withdrawal |
| `POST events` | Explicit owner interest with permission/version revalidation |
| `GET audiences` | Source-scoped references/counts, without members or contacts |
| `POST rights` | Account deletion and central suppression receipt |

The central service owns deduplication, durable event processing, provenance,
audience eligibility and suppression. marKER has no retry queue for optional
events and never retries an uncertain event under a new ID automatically.
Campaign operations do not call Analytics and continue during an outage.

## Compatible migration and rights

`0013_analytics_subject.sql` adds one necessary rights-routing row containing a
64-character subject and optional deletion receipt. It stores no preferences or
event history. Before the first central mutation the relay durably records this
reference; failure prevents the outbound request. The insert guard follows the
existing account lifecycle and refuses closed accounts.

The existing leased account-deletion processor requests central deletion before
purging local identity. Missing credentials or an unconfirmed response retain
the normal retry state. The central receipt confirms deletion within Analytics;
the receiver state remains `check_delivery_receipts`. It does not prove remote
recipients deleted information. Final local account cleanup removes the link.
The central rights implementation must tombstone the subject and deny later
in-flight writes; it owns recipient suppression evidence.

## Verification and activation dependencies

Directed verification: 13 Analytics tests plus 29 adjacent auth/policy/profile
checks passed (42 total). They cover pause, expiry, failed acknowledgements,
tenant/source isolation, GPC, recipient separation, privacy-field refusal,
analytics-versus-commercial purposes, no credential traffic, audience projection
and deletion retries. Frontend/server types, production build and immutable-logo
verification passed. Real local Edge browser checks covered desktop EN/mobile ES
with a disconnected source, refresh and no 390px horizontal overflow. Locally
mocked synthetic central replies demonstrated separate grants, a declared event
and withdrawal; they are not hosted traffic, users or income.

No marKER deployment, remote migration, token provisioning or real collection was
performed for this increment. Activation requires the tested central release,
additive migration application, a separate source credential, published notice
matching the actual treatment, a concrete source configuration and rights.
Real partner use additionally requires its identity, contract, countries,
permitted fields and suppression mechanism. No external buyer is enabled here.

Reversal: pause the source centrally first; disable the optional credential only
after resolving any existing subject rights. Restore the prior Worker/frontend
version if needed. Keep the additive table until its rights references are
resolved. Do not drop unrelated data or revert accumulated repository history.

Commercial research and an initial offer are maintained in
[the dated research note](analytics-commercial-research-20261025.md).

## Review corrections — 2026-10-25

Central expiry is now a supported read state: `expired` preferences remain
visible and cannot activate the interest button. An observed `Sec-GPC: 1` is
forwarded with the server-derived subject on overview, preference and audience
reads, and before rejecting an excluded event. The central exclusion therefore
also cancels earlier covered jobs and removes audience eligibility. Browsers
that expose only `navigator.globalPrivacyControl` automatically submit the same
exclusion through the existing preference endpoint when Settings loads. This
requires no manual withdrawal click and preserves separate `partner_intro`
and `optional_analytics` choices.

The correction passed 47 directed backend/UI/auth/policy/profile tests, build,
types and original-logo verification. An additional actual-code integration
connected marKER's relay to central `handleCollectionControl`, `control-store`
and both additive schemas using in-memory SQLite. It verified real central
expiry processing, source acknowledgements, UUID permission receipts, event
deduplication, GPC cancellation of queued covered purposes, audience removal,
preserved independent choices, rights receipts and token/source mismatch.
All 36 fetch calls were routed within that local harness; no external request,
production migration, credential or commercial activation was performed.
