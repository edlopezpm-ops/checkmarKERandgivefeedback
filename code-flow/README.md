# marKER code flow — functional node reference

These traces describe the pinned source behavior without publishing implementation bodies. Read the ordinary/error/conflict branches alongside the node responsibility tables. Static calls/imports in the catalog locate syntax; hand-traced diagrams explain intended control sequence and effect custody. They are not a dynamically measured call graph.

| Trace | Scope |
| --- | --- |
| [01 Request, access and storage](01-request-auth-and-storage.md) | Browser request, native identity, validation, repositories and revision/error responses. |
| [02 Browser and editorial](02-browser-and-editorial.md) | UI navigation, drafts, commands, recovery and explicit outcomes. |
| [03 Media planning, rendering and export](03-media-planning-render-export.md) | Capture/upload, source/rights selection, planning, durable jobs, processor and revision approval. |
| [04 Animation and help](04-animation-and-help.md) | Decoration lifecycle, scheduler/Cueca, EN/ES contextual help and preferences. |
| [05 Every module and symbol](05-module-symbol-index.md) | Parsed declarations, type structure, import/call-site metadata and limits. |

For troubleshooting, record observed version/time, entry/method, proof branch, expected named function, durable revision/job/upload stage, external-effect status and safe response. Do not include cookies, codes, owner addresses, raw media/text or provider payloads. A network failure does not prove a write/compute never occurred; reload/reconcile the exact operation before retrying.

For a proposed patch, update affected nodes, contracts and focused failure checks together. Rebuild this documentary snapshot only from an explicitly selected new source revision. Do not treat this public reference as an external API stability promise or permission to activate a service.
