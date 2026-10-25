# 09 — Review guide and open decisions

Review the full source projection, not only this narrative. Preserve the independent no-agent native workflow, one retained owner/tenant, explicit rights/readiness/speech facts, original media, immutable generation/job provenance, revision conflicts, human approval of exact output and manual export. Preserve the original logo/font/license assets. Avoid rebuilding delivered functionality or adding a provider call to deterministic work.

| Area | Concrete review question |
| --- | --- |
| Native flow | Can Space selection, recovered drafts or cached variants substitute an earlier source set or overwrite human copy? |
| Classification | Can missing-label rules accidentally imply rights, readiness, semantic quality or speech absence? |
| Planner | Can changed permissions, ranges/history, explicit consent or stale fingerprints bypass server recomputation? |
| UI | Are selection, stale revisions, interrupted uploads, optional Agents and errors understandable on narrow screens and keyboard navigation? |
| Auth/lifecycle | Can concurrent callback/session/bridge/MCP work survive account freeze, relink identity incorrectly or recreate deleted data? |
| MCP authorization | Are PKCE/resource/client/tenant/scope checks, refresh reuse, consent CSRF, private downloads and revocation correct at every boundary? |
| MCP effects | Can ambiguous network failure cause a duplicated mutation, stuck receipt or unsafe retry? Is reconciliation actionable? |
| Agents | Can context drift, lease expiry, cancellation or completion replay fabricate provenance or repeat inference/effects? |
| Processor/custody | Are deadlines, parser/protocol bounds, reservations, enqueue recovery and object finalization safe under interruption? |
| Retention | Are applied evidence, grants, multipart leftovers and deletion exclusions truthful and operationally maintainable? |
| Complexity | Which abstraction or duplicated boundary can be removed while preserving the mandatory behavior? |
| Value | Which minimal workflow improvement would measurably reduce active preparation time? |

Open decisions include actual hosted SIWC admission; actual connector-host installation and capabilities; enabling technical analysis only after hosted binary verification; physical-device pilot; granular media retention/restore policy; and any later social publication scope. A source-level concern is not evidence that an exploit occurred; an absent test is a coverage gap rather than a demonstrated bug.

For every finding provide priority, exact source path/line, observed behavior, trigger or counterexample, confidence/evidence class, user impact, smallest coherent change, affected frontend/backend/schema/effect boundaries, preserved invariants, focused success/failure/concurrency tests, migration/recovery needs and any unresolved owner decision. Separate demonstrated defects, plausible risks, usability improvements and optional roadmap work. Do not claim runtime performance, provider eligibility, actual invoices, UAT or deployed behavior from static source.

End with a coverage ledger: files/flows actually read, tests actually run, evidence unavailable, and findings ordered by impact. Recommendations can propose changes, but this review request itself does not authorize deployment, paid/provider calls, credential access, messages, social publication or destructive owner-data operations.
