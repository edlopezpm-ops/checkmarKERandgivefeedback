# 04 — Frontend and interaction

[App](source/src/App.tsx) and [Console](source/src/console/Console.tsx) organize authentication, navigation, lazy-loaded modules and shared state. [Studio](source/src/console/Studio.tsx) stays mounted while the Agents panel or another Console section opens, preserving preparation work. Editorial state and Studio state are separate; refreshed revisions and draft recovery must not silently overwrite newer persisted data.

| Surface | Inspect |
| --- | --- |
| Capture/material library | [Studio.tsx](source/src/console/Studio.tsx), [studio.css](source/src/console/studio.css) |
| Rules and selection | [StudioPlanner.tsx](source/src/console/StudioPlanner.tsx), [StudioAnalysis.tsx](source/src/console/StudioAnalysis.tsx) |
| Agents/conversation/proposals | [Agents.tsx](source/src/console/Agents.tsx), [context](source/src/console/agent-context.ts), [stream](source/src/console/agent-stream.ts) |
| Authentication/CAPTCHA | [Authentication.tsx](source/src/console/Authentication.tsx), [Turnstile.tsx](source/src/console/Turnstile.tsx) |
| Profile/policies | [Profile.tsx](source/src/console/Profile.tsx), [Policies.tsx](source/src/console/Policies.tsx) |
| Limits/device preferences | [Settings.tsx](source/src/console/Settings.tsx), [EnvironmentSettings.tsx](source/src/console/EnvironmentSettings.tsx) |
| Delegated connections/login continuation | [McpConnections.tsx](source/src/console/McpConnections.tsx), [mcp-resume.ts](source/src/console/mcp-resume.ts) |
| Help/errors/language | [Help.tsx](source/src/console/Help.tsx), [help-guides.ts](source/src/console/help-guides.ts), [ErrorNotice.tsx](source/src/console/ErrorNotice.tsx), [i18n.tsx](source/src/i18n.tsx) |

English is default; Spanish and optional dark mode are browser preferences. Language changes UI copy, not saved content. Settings persists workspace limits across devices while Environment holds device choices. Unsaved text/recipes can be recovered from browser session storage with explicit conflict handling. Microphone recording is bounded and permission-driven, but unfinished recording recovery in memory is not durable background capture.

The complete approved logo is retained as its original asset; font/license and AEKR attribution assets are included. Dark-mode presentation is part of the source and should be evaluated visually, including complete logo geometry. The decorative pixel characters remain an inert right-side feature with scheduler, reduced-motion/off/pause controls and optional local cache. Asset hashes establish bytes, not temporal animation or perceptual quality.

Contextual lowercase help is at the bottom left of modules. The source guide includes topic/step navigation and images for each step in both languages. Error notices, focus restoration, nested Escape handling, keyboard use, narrow-width overflow and draft preservation are review targets; prior browser checks do not imply universal assistive-technology or physical-device coverage.

Agents and Environment share the ordinary connect/status/revoke view. The main CTA opens the registered private marKER App-backed plugin in ChatGPT; an expandable secondary path supplies the endpoint for another compatible assistant. Explicit loading, retry/refresh and two-step disconnect distinguish connection states. Chat happens in the external assistant; marKER retains draft review, approval and export. Local bridge controls, polling and bridge-limit settings appear only in explicit loopback development affordances.

On OAuth login handoff, [mcp-resume.ts](source/src/console/mcp-resume.ts) accepts one bounded correlation handle, removes only that query parameter while preserving other URL/history values, and keeps it briefly in session storage. It consumes the handle before navigation and resumes only after `/api/session` reports authenticated=true. Invalid, repeated, expired or unavailable-storage cases do not authorize a continuation. The server validates the actual transaction and explicit owner consent; Strict owner-cookie behavior is retained.

The [retained synthetic local screenshot](review-assets/README.md) documents the earlier connection-list UI, not the current connect flow. Current bilingual connection/context illustrations are included in [public Help source](source/public/help/); four new images accompany the updated guide. Reported desktop/mobile viewport checks use synthetic fixtures and do not establish physical-phone or actual host OAuth behavior.
