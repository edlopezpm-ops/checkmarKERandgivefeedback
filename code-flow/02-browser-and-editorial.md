# Browser and editorial flow

[Console](../source/src/console/Console.tsx) → [client](../source/src/core/client.ts) → [shared API](../source/server/api.ts) → [domain command](../source/src/core/domain.ts) → repository CAS → fresh snapshot. Server validation owns relationships, slot conflicts, deletion guards and explicit outcomes. Browser drafts and error display do not authoritatively override a failed command.

An OAuth handoff supplies only a short-lived correlation handle. [mcp-resume.ts](../source/src/console/mcp-resume.ts) removes it from the visible URL, preserves unrelated query/history values, and consumes it before authenticated navigation to the server resume endpoint. It cannot itself grant owner access.

Studio is mounted separately; selection/draft state flows through [StudioPlanner](../source/src/console/StudioPlanner.tsx). The [native UI regression tests](../source/tests/studio-native-ui.test.ts) target explicit selection versus saved/cached variants. Profile and Settings use independent revision domains. Old editor/source/account controls remain available without becoming social provider connections.
