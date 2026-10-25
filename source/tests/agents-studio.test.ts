import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStudioApi } from "../server/studio-local.ts";
import { emptyWorkspace } from "../src/core/domain.ts";
import type { StudioGenerationOrigin, StudioState, TrustedStudioInvocation } from "../src/core/studio.ts";

test("trusted agent save retains provenance through edits, source snapshots, approval and export; HTTP fields cannot forge it", async () => {
  const directory = await mkdtemp(join(tmpdir(), "marker-agent-provenance-"));
  const studio = createStudioApi({ directory, tools: { ffmpeg: "missing", ffprobe: "missing" } });
  const workspace = emptyWorkspace();
  workspace.products.push({ id: "product", name: "Example", description: "", audience: "", language: "es", tone: "", cta: "", url: "", status: "available" });
  let state: StudioState;
  const generation: StudioGenerationOrigin = { kind: "agent", runId: "run", proposalId: "proposal", connectionId: "connection", provider: "openai-codex", model: "observed-model", createdAt: "2026-10-24T12:00:00Z", sourceRefs: [{ materialId: "source", contentVersion: 2 }] };
  async function call(path: string, data?: unknown, trusted?: TrustedStudioInvocation) {
    const response = await studio.handle(new Request(`http://127.0.0.1:5185/api/studio${path}`, data === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }), workspace, trusted);
    assert.ok(response);
    return response;
  }
  async function command(type: string, data: unknown, trusted?: TrustedStudioInvocation) {
    const response = await call("/commands", { expectedRevision: state.revision, command: { type, data } }, trusted);
    assert.equal(response.status, 200, await response.clone().text());
    state = (await response.json()).state;
  }
  try {
    state = (await (await call("")).json()).state;
    await command("material.save", { title: "Forged", kind: "text", text: "Client cannot claim provenance", generation });
    assert.equal(state.materials[0].generation, undefined);
    await command("material.save", { title: "Chosen copy", kind: "text", text: "Copy to edit", productIds: ["product"], categories: ["ready-text"], review: "ready", rights: "owned" }, { newId: "agent-proposal", generation });
    assert.deepEqual(state.materials.find(m => m.id === "agent-proposal")?.generation, generation);
    await command("material.save", { id: "agent-proposal", text: "Edited by owner", generation: { ...generation, runId: "forged" } });
    const material = state.materials.find(m => m.id === "agent-proposal")!;
    assert.deepEqual(material.generation, generation);
    assert.equal(material.contentVersion, 2);
    await command("campaign.save", { title: "Example", productId: "product" });
    await command("variant.save", { campaignId: state.campaigns[0].id, template: "text", body: material.text, sourceIds: [material.id] }, { newId: "agent-variant" });
    assert.deepEqual(state.variants[0].sourceSnapshots[0].generation, generation);
    const approve = await call("/variants/agent-variant/approve", { recipeRevision: 1, confirmed: true });
    assert.equal(approve.status, 200);
    const approved = await approve.json();
    const receipt = await (await call(`/jobs/${approved.job.id}`)).json();
    assert.deepEqual(receipt.receipt.sourceSnapshots[0].generation, generation);
    assert.equal(await (await call("/variants/agent-variant/export")).text(), "Edited by owner");
  } finally {
    await studio.close();
    await rm(directory, { recursive: true, force: true });
  }
});
