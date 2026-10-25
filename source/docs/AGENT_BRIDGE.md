# Local Codex connection

marKER's Agent panel uses a separate local Node process and the official Codex app-server protocol. The selected provider is OpenAI Codex, the authentication mode is native ChatGPT, and usage belongs to the signed-in ChatGPT subscription. No API key or paid API fallback is supported by this adapter. Studio continues to own material saving, planning, variants, rendering, review, approval and export.

The native adapter accepts **loopback marKER origins only**. Current [official OpenAI app-server documentation](https://learn.chatgpt.com/docs/app-server) limits its native authentication to local/open-source applications and excludes commercial/hosted services. This implementation does not establish hosted Sign in with ChatGPT admission. The Worker/D1 agent contracts remain portable, while a future hosted provider requires its own authorized adapter. The official app-server interface is experimental; verify compatibility when updating Codex.

## Start the connection

1. Install the official Codex CLI if needed. Run `codex login` and explicitly choose ChatGPT. Existing native login can be reused without copying credentials.
2. Start local marKER using `npm run dev`. Open the printed loopback address.
3. In Studio, select the product, campaign and materials. Open **Agents / Agentes**, then create a local connection. The pairing token appears once and expires after ten minutes if unused.
4. In another PowerShell terminal, from the marKER repository, run the command shown by the panel. For example:

```powershell
$env:MARKER_ORIGIN = 'http://127.0.0.1:5173'
$env:MARKER_BRIDGE_TOKEN = '<pairing token shown in marKER>'
npm run agent:bridge
```

Use the actual development port. The token authorizes only the agent bridge endpoints and is distinct from owner authentication and native Codex credentials. Keep it out of source files and shared terminal captures. The bridge removes this token and API/provider credentials from its Codex child environment. Disconnect/revoke the connection in the panel to invalidate its token.

The connection becomes available only after a real app-server handshake, `account/read` confirms ChatGPT authentication, and the local process sends its account label, model and capabilities to marKER. A model catalog alone does not establish successful inference or entitlement. A completed real turn verifies execution for that particular request. The native account can differ from the marKER login account; possession of a pairing token follows an authenticated owner action, rather than an email-address match.

## Work inside marKER

Ask for copy using the selected materials. The bridge forwards the server's exact Studio snapshot and bounded conversation history to a fresh ephemeral Codex thread. Real app-server message deltas feed the panel; validated completion creates editable proposals. Edit and save a proposal through Studio's existing `material.save` flow. Request assembly alternatives, apply one through the deterministic planner, then use the existing render, review, approval and export actions.

The editorial assistant has no local shell, filesystem browsing, connectors, browser, computer-use, media-generation or autonomous subagent tools. Reading selected product/material context occurs on the marKER server before dispatch. Product actions remain explicit server-validated operations; a conversational claim does not constitute a saved material, render or approval.

Native Codex still inherits its exact global `$CODEX_HOME/AGENTS.md` owner policy. The bridge permits that known source only, rejects project instruction sources, uses a temporary working directory, replaces model instructions and disables project-document loading. It explicitly disables inherited MCP servers before opening any thread because an empty TOML table does not remove merged servers. The process checks effective `never` approvals and read-only, network-disabled execution policy. Native authentication storage stays owned by Codex; marKER never reads or forwards OAuth tokens.

## Runtime and recovery

The bridge opens no inbound HTTP/WebSocket listener. It communicates with its Codex child over stdio and polls local marKER over authenticated HTTP. The FFmpeg processor remains independent.

| Contract | Behavior |
| --- | --- |
| Heartbeat | Reports verified account/authentication, subscription billing, selected default model and actual capabilities; refreshes availability every fifteen seconds while idle. |
| Poll | Claims one queued run with an exclusive execution lease. A missing lease refuses execution. |
| Events | Sends actual activity and message deltas in bounded batches; no simulated work progress. |
| Cancellation | Observes server cancellation, invokes `turn/interrupt`, and records `cancelled` only for an interrupted turn. Provider consumption may already have occurred. |
| Completion | Requires `turn.status=completed`, valid JSON and bounded structured proposals. Provider failure, malformed output and interruption never report success. |
| Recovery | Stores final output and its lease in an ignored local receipt before delivering completion. A lost completion response is replayed idempotently on restart without another inference call. |

Connections, conversations, runs and proposals persist in agent-specific storage, separately from the editorial Workspace JSON. The local completion receipt is `.local/agent-bridge-receipt.json`; it contains generated content and the run lease, so keep it private. `MARKER_BRIDGE_RECEIPT` can select another private receipt path. Normal successful delivery removes it. A process crash while the provider is still running is recovered by the server as an expired/uncertain run rather than automatically requeued.

If a completed result was saved locally but never reached marKER, restart the bridge with the original connection and receipt. It replays that result before starting a provider runtime. The server validates the original lease and structured result and can reconcile a run closed by lease/deadline expiry. The same run/proposal IDs and daily admission remain in place; no new inference or Studio effect is performed. Revocation, explicit cancellation and an explicit provider failure remain closed. An invalid result or a different lease cannot reopen a run.

History cleanup removes old activity and unused conversations. Applied proposals and their associated source context/run/session are retained for provenance and idempotency, including after the cleanup horizon. This is separate from Studio custody and does not promise provider-side erasure. The initial 1,000 retained-run and 200-session ceilings require maintenance if reached; saved source evidence is not silently purged to admit new work.

Only one bridge process should handle a connection. Keep its terminal open while working. Closing the terminal makes availability expire; start it again with the connection token to reconnect, or create a new pairing after revocation. The bridge stops on connection/lease errors. It does not switch account, model/provider or billing route automatically.

The adapter bounds serialized input to 160,000 characters, accepted output to 48,000 characters, and proposals to three with per-field limits. Individual accepted output limits and cancellation do not create a provider token or invoice hard cap. Server Settings enforce daily/concurrent runs, retention policy and admitted run duration. The runtime follows the admitted server deadline, capped at fifteen minutes; a request already past that deadline never starts inference. Standalone smoke checks have a 110-second timeout. A timeout after dispatch may consume subscription usage and never causes an automatic retry. Recorded retention policy does not promise deletion from the provider's native authentication/runtime stores or external service retention.

## Diagnostics and verification

```powershell
npm run agent:bridge -- --status
node --experimental-strip-types --test tests/agent-bridge.test.ts
```

`--status` reads the native account and model catalog without starting inference. `--once` polls at most one job. `--smoke` explicitly starts one real fictional notebook-copy request using the current ChatGPT account and therefore consumes subscription usage:

```powershell
npm run agent:bridge -- --smoke
```

The bridge resolves a native Codex executable without a shell; on Windows it can also launch the official npm CLI JavaScript entry point through Node. `MARKER_CODEX_BIN` explicitly selects an installed binary. The reported app-server `userAgent` identifies the actual runtime; it can differ from a separate npm `codex --version` on PATH.

On 2026-10-24, native `account/read` reported a Pro ChatGPT session, and one real `gpt-6.1-sol` fictional-copy turn completed with three validated Spanish proposals and 141 streamed delta events. That verifies the tested local request. It is separate from browser integration checks, human UAT, hosted admission, deployment and production readiness. No native credential was read or copied by marKER.

Official references: [Codex app-server protocol and authentication](https://learn.chatgpt.com/docs/app-server), [Codex authentication](https://learn.chatgpt.com/docs/auth), [configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference). Checked 2026-10-24.
