# Media, planning, rendering and export

[Studio UI](../source/src/console/Studio.tsx) → resumable upload adapter → native probe/hash → original asset and material → [classifier](../source/src/core/studio-classification.ts). Labels never establish rights/readiness/speech.

Selection → [prepareStudioPlan/native planner](../source/src/core/studio-planner.ts) → permissions/history/ranges/copy/readability checks → editable alternatives → server recomputation/fingerprint → [Studio domain](../source/src/core/studio.ts) save with CAS.

Saved variant → durable job/admission → [processor](../source/server/studio-processor.ts) → [renderer](../source/server/studio-render.ts) → private MP4/cover and immutable receipt → actual owner review → exact recipe/job approval → native export. Recipe/permission drift invalidates earlier approval. No stage publishes to a social API. [Native flow tests](../source/tests/studio-native-flow.test.ts) and [MCP integration tests](../source/tests/mcp-integration.test.ts) cover separate entry routes to this same backend.
