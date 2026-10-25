# AI connection decision

Update, 2026-10-24: the owner authorized the real private local Agents workflow. The implemented [local Codex bridge](AGENT_BRIDGE.md) uses official managed ChatGPT authentication and was verified with a Pro session and a completed `gpt-6.1-sol` turn. The panel, durable agent ledger and existing Studio tools are described in [Agents](agents.md). This native adapter accepts loopback marKER only; it refuses hosted origins and API-key billing. Hosted SIWC admission/client/plan-usage authorization remain unestablished. The 2026-10-23 evaluation below is retained as the hosted-route record, rather than a claim that local inference is still absent.

Current increment (2026-10-24): the owner selected an authenticated external
assistant connector following Astra's real read/write tool pattern, preserving
the native algorithm. The [MCP connector](mcp-connector.md) implements that route
over the existing backend. Source/SDK verification does not establish deployed
installation or a live dot conversation. Hosted subscription inference remains a
separate, unadmitted route; no API billing or provider fallback was selected.

Earlier decision (2026-10-23): the owner selected generation inside marKER and
evaluation of Sign in with ChatGPT first. Application/account admission was not
established. The following evaluation remains relevant to that inference route.

Request update, 2026-10-23: the owner completed the official interest-form submission and supplied its visible receipt acknowledgement. No admission, client ID, callback registration or plan-usage grant follows from that receipt. The acknowledgement does not show the final capability selection; verify that OpenAI's eventual response covers ChatGPT plan usage for this hosted product. [Local simulated generation](text-simulation.md) now prepares source selection, editable review and revision-protected draft saving without any provider execution.

## Selected route: Sign in with ChatGPT

Operating scope: the owner currently operates as an individual under the personal project name AEKR, without an incorporated company. Prefer an official individual-developer route wherever the provider supports it. AEKR may identify the project; it is not represented as a legal company. Request personal or verification information only when the actual provider flow requires it. A future company will be handled as a later ownership/billing/registration change according to that provider's process, not as a prerequisite invented for the current project.

marKER is a private web application hosted at [marker.aekr.io](https://marker.aekr.io), with an existing sole-owner email-code session. The published [plan-usage overview](https://developers.openai.com/siwc/token-sharing-open-source) sends remotely hosted applications to an access request. The [client-ID page](https://developers.openai.com/siwc/request-client-id) describes selected-partner availability and links the [official interest form](https://openai.com/form/sign-in-with-chatgpt-interest/). This is an access-request path, not proof of admission or a rejection. A single owner does not establish an exception to the hosted-app requirement.

Two permissions must be established separately: admission of this hosted application for plan usage, and eligibility/consent of the connecting account. The [quickstart](https://developers.openai.com/siwc/quickstart) documents eligible Plus/Pro users and selected private clients. Identity-only sign-in does not authorize generation. The owner reports a separate personal Pro account, which is the candidate for connection; its live eligibility/consent remain unverified. The work account is reported as Free with access to a paid workspace whose exact plan and policy are unconfirmed. Workspace access is not evidence that the personal Free account has Pro entitlement.

| Requirement | Current evidence | Next evidence needed |
| --- | --- | --- |
| Hosted/private application admission | No issued client or approval is recorded in marKER's implementation/configuration. | OpenAI confirmation covering this remotely hosted private product and ChatGPT plan usage. |
| Account and workspace | Owner-reported personal Pro candidate; separate Free/work account with unconfirmed paid-workspace type/policy. No live entitlement check. | Eligible selected account/workspace and actual user consent; an email match is insufficient. |
| Web identity client | Existing email-code auth is implemented; no SIWC routes/client integration. | Issued client ID, exact callbacks registered per environment and registered client-authentication method. |
| Connection security | Existing owner session and D1 can anchor linking. No OAuth transaction/token storage exists. | PKCE/OIDC validation, atomic expiring one-use state, verified issuer/client/subject binding, protected token lifecycle and disconnect/revocation behavior. |
| Inference authority | No plan-usage authorization or provider execution. | Granted inference scopes and the approved hosted-client request contract, available models and usage limits. |

The [web integration guide](https://developers.openai.com/siwc/website) supplies identity prerequisites and allows an already authenticated user to confirm adding a ChatGPT identity. The connection can use a different email from the existing marKER owner: bind the verified external identity to that authenticated owner after explicit confirmation, preserving the existing login allowlist. This does not establish hosted plan-usage approval. Any callback chosen during implementation must match OpenAI's registration exactly. No callback has been registered by this evaluation. The local/open-source dynamic-registration route is not selected for the deployed private web application. No public eligibility preflight was found in the reviewed SIWC documentation; account sign-in alone cannot establish hosted-application admission.

The published [plan-usage preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations) require streamed requests with `store: false` and do not support `max_output_tokens` or background/conversation fields. Confirm the applicable hosted-client contract before implementing controls. In particular, an application-side stream limit or cancellation cannot promise a hard provider token/charge cap. Image generation and audio/video transcription are outside this published flow; later media work needs its own supported route. `store: false` is a request setting, not a promise about all provider retention.

The submitted request concerns an individual developer operating the AEKR personal project and its hosted single-owner product. The form accepted a submission, while actual program admission and the final submitted capability selection remain unverified. AEKR is not an incorporated company; no legal-company, tax or registration facts are invented. The requested integration needs **identity plus ChatGPT plan usage**. After OpenAI responds, establish admission and the exact permissions, obtain the issued client/registered callback, then implement protected connection linking and controlled inference using the contract below. The existing local simulator does not dispatch inference.

## Existing-account and API routes

| Route | Where the owner works | Prerequisite | Current marKER state |
| --- | --- | --- | --- |
| Sign in with ChatGPT and plan usage — selected for evaluation | marKER web UI | Eligible account, approved application and separately granted inference permission | Evaluation complete; hosted-app admission, account eligibility and client registration unverified. No sign-in or token exchange performed. |
| Standard OpenAI API | marKER web UI | Product-specific server credential, selected model and explicit spending limits | Not configured or invoked; no default model/budget selected. |
| ChatGPT/Codex plus authenticated MCP tools | ChatGPT/Codex UI, with marKER as the data backend | Account/plugin availability and a verified authenticated connector | Additive connector implemented in the 2026-10-24 source increment. Production activation and actual assistant installation/conversation remain separate. It does not replace the native UI or local bridge. |

An email address alone is not inference authority. Keep the existing sole-owner marKER session separate from any OpenAI connection. Linking a connection must confirm the authenticated owner and the verified external identity; do not grant access merely because email strings match. Do not reuse browser cookies, unrelated application tokens or Codex credentials as a marKER provider credential.

Official documentation checked on 2026-10-23. [ChatGPT Work/Codex pricing](https://learn.chatgpt.com/docs/pricing) separates API token prices from subscription usage. The owner selected the SIWC evaluation; neither API billing nor a ChatGPT/Codex MCP interface has been selected.

## Shared generation contract

All routes reuse the existing product/source/campaign/post relationships and produce editable text only; no publishing, paid activation, multimedia readiness or account-connection claim. The inference contract below applies when marKER dispatches inference through API or eligible Sign in with ChatGPT plan usage.

In the MCP route, ChatGPT/Codex hosts generation and controls its own model and plan usage. marKER exposes authenticated source-reading and draft-writing tools with workspace revisions, input limits and idempotent writes; it does not claim to reserve or control the host's inference billing and does not need its own inference job merely to serve those tools. MCP can be selected as the first integration route rather than deferred until later extensions.

| Boundary | Required behavior |
| --- | --- |
| Input snapshot | Bind the request to the authenticated owner, workspace revision, campaign, source IDs and destination drafts. Reject missing/incompatible records; never invent approved commercial facts. |
| Explicit request | Require an owner action and a request identifier. Repeating the same request must not create another charge/job; a changed input needs a new request. |
| Provider admission | Require a selected route, actual granted scope/credential, selected model and explicit limits. Missing decisions fail closed without a network call. No automatic provider fallback. |
| Limits | Bound submitted input, accepted output, execution time and concurrency; define spending or plan-usage admission according to the actual route. Reserve admission before execution and reconcile actual reported usage. If the provider lacks a hard output/usage cap, disclose that limitation before execution; local cancellation or rejecting extra output does not guarantee provider consumption stopped. Do not present an estimate as a billing guarantee. |
| Results | Validate a structured result tied to known destination IDs and selected sources. Show the draft for human review; do not overwrite a subsequently edited post. Saving a result uses the existing revision/conflict boundary. |
| Failure and uncertainty | Distinguish never-started, running, successful, rejected, cancelled and uncertain execution. Cancellation may be best effort after dispatch. A timeout does not prove no provider execution; no blind retry or automatic release of an uncertain reservation. |
| Retention | Owner must decide retention for source snapshots, generated text, minimal job receipts and backups. Specify how later deletion/restore interacts with those records and external provider retention. No hidden AI memory or automatic purge promise. |
| Recovery | Preserve enough non-secret identity/state evidence to reconcile an interrupted job without duplicating execution. Revisit storage/migrations before adding durable jobs to the current 1 MiB workspace design. |

Open decisions: actual hosted-app admission and account eligibility for the selected SIWC evaluation; issued client/permissions and applicable request contract; model availability; plan-usage limits; execution/input/output/concurrency limits; retention and recovery policy. No values are silently defaulted. No new endpoint, migration, live resource or provider integration is created by this contract document.

Verification for the selected implementation must cover unauthorized admission, duplicate requests, stale inputs, budget/limit exhaustion, malformed provider output, partial failure, uncertainty, cancellation, concurrent editing and recovery. Synthetic execution is useful evidence but cannot establish live eligibility, billing behavior or owner acceptance of the new phase.
