import test from "node:test";
import assert from "node:assert/strict";
import { agentVariantDrift } from "../src/console/agent-context.ts";

test("recipe revision drift is visible even when the same variant and materials stay selected", () => {
  const captured = { id: "variant-selected", recipeRevision: 1 };
  assert.deepEqual(agentVariantDrift(captured, [{ id: captured.id, recipeRevision: 2 }]), { id: captured.id, capturedRevision: 1, currentRevision: 2 });
  assert.equal(agentVariantDrift(captured, [{ id: "other-variant", recipeRevision: 20 }, captured]), undefined);
});

test("removed captured recipes differ from a Studio snapshot that has not loaded", () => {
  const captured = { id: "variant-selected", recipeRevision: 3 };
  assert.deepEqual(agentVariantDrift(captured, []), { id: captured.id, capturedRevision: 3, currentRevision: undefined });
  assert.equal(agentVariantDrift(captured, undefined), undefined);
  assert.equal(agentVariantDrift(undefined, []), undefined);
});
