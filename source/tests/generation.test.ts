import test from "node:test";
import assert from "node:assert/strict";
import { applyCommand, emptyWorkspace } from "../src/core/domain.ts";
import { createTextSimulation, TEXT_SIMULATION_LIMITS } from "../src/core/generation.ts";

// The three owner-approved fictional demo scenarios; no live workspace is read.
const examples = [
  { name: "Taller Nube", platform: "LinkedIn", host: "taller-nube.invalid", kind: "organic", title: "Presentación del cuaderno", facts: "Taller Nube y su cuaderno son ficticios. Este material permite practicar una presentación editorial sin precios, disponibilidad ni venta real.", draft: "Conoce el cuaderno ficticio de Taller Nube. Revisa tono y claridad en este contenido de prueba; no representa una oferta real." },
  { name: "Biblioteca Brisa", platform: "Facebook", host: "biblioteca-brisa.invalid", kind: "organic", title: "Invitación editorial", facts: "Biblioteca Brisa es un club de lectura ficticio. No existe evento, fecha de reunión ni inscripción. Practica revisión de texto y exportación manual.", draft: "Ejercicio editorial de un club de lectura ficticio. No hay evento ni inscripción real. Revisa este borrador antes de marcarlo como listo." },
  { name: "Estudio Faro", platform: "X", host: "estudio-faro.invalid", kind: "paid", title: "Propuesta publicitaria pausada", facts: "Estudio Faro es un estudio de ilustración ficticio. El presupuesto de 25 USD es simulado y no autoriza gasto. La campaña debe permanecer pausada.", draft: "Propuesta de ilustración ficticia. Texto de prueba para una campaña pausada: sin anuncio, inversión ni oferta real." },
];
function fixture() {
  let state = emptyWorkspace(), nextId = 0;
  const run = (type: string, data: Record<string, unknown>) => {
    state = applyCommand(state, { type, data }, "2026-10-23T12:00:00.000Z", () => `demo-${++nextId}`);
  };
  for (const [i, example] of examples.entries()) {
    const label = `DEMO 20261023-${i + 1} · ${example.name}`;
    run("product.save", { name: label, description: `DATOS FICTICIOS DE PRUEBA. ${example.facts}`, audience: "Público ficticio para pruebas", language: "Español", tone: "Claro y directo", cta: "Consultar ejemplo ficticio", url: `https://${example.host}/ejemplo`, status: "preparation" });
    const productId = state.products.at(-1)!.id;
    run("account.save", { name: `${label} · ${example.platform}`, platform: example.platform, url: `https://${example.host}/cuenta-demo`, productIds: [productId], timezone: "America/New_York", language: "Español" });
    const accountId = state.accounts.at(-1)!.id;
    run("source.save", { productId, title: `${label} · Brief ficticio`, text: `DEMO. ${example.facts}\nEste material no describe un producto, cuenta o resultado real.`, declaredDate: "2026-10-23" });
    run("campaign.create", { productId, title: `${label} · ${example.title}`, objective: `Prueba ficticia del flujo manual. ${example.kind === "paid" ? "Presupuesto simulado; mantener pausada, sin activar anuncios." : "Revisar y exportar un borrador sin publicar."}`, audience: "Público ficticio para pruebas", sourceIds: [state.sources.at(-1)!.id], accountIds: [accountId], kind: example.kind, ...(example.kind === "paid" ? { currency: "USD", budget: "25.00" } : {}) });
    run("post.save", { id: state.posts.at(-1)!.id, text: `DEMO · ${example.draft} https://${example.host}/ejemplo`, scheduledAt: "", status: "draft", formatConfirmed: false });
  }
  return state;
}
function request(state = fixture(), index = 0, requestId = "request-1") {
  return { requestId, revision: state.revision, campaignId: state.campaigns[index].id, postId: state.posts[index].id, sourceIds: [state.sources[index].id] };
}

test("all three fictional examples generate editable simulated drafts with exact source IDs and paused paid state", async () => {
  const state = fixture(), before = structuredClone(state), simulation = createTextSimulation({ latencyMs: 0 });
  try {
    for (let i = 0; i < examples.length; i++) {
      const input = request(state, i, `example-${i}`), result = await simulation.generate(state, input);
      assert.equal(result.simulated, true);
      assert.deepEqual(result.request, input);
      assert.deepEqual(result.sourceIds, input.sourceIds);
      assert.ok(result.text.includes(examples[i].facts));
      assert.ok(result.text.includes("SIMULACIÓN LOCAL"));
      const edited = `Revisado por la persona.\n${result.text}`;
      const save = simulation.prepareSave(state, result, edited);
      assert.equal(save.revision, state.revision);
      const saved = applyCommand(state, save.command);
      assert.equal(saved.posts[i].text, edited);
      assert.equal(saved.posts[i].status, "draft");
      assert.equal(saved.posts[i].formatConfirmed, false);
      assert.equal(saved.posts[i].scheduledAt, state.posts[i].scheduledAt);
      assert.equal(saved.posts[i].externalUrl, "");
      assert.equal(saved.campaigns[2].status, "paused");
      assert.equal(saved.campaigns[2].budget, "25.00");
      assert.throws(() => simulation.prepareSave(saved, result, edited), /cambió/);
    }
    assert.deepEqual(state, before);
  } finally { simulation.clear(); }
});

test("concurrent duplicates share one result; changed input or snapshot cannot reuse the request ID", async () => {
  const state = fixture(), input = request(state), simulation = createTextSimulation({ latencyMs: 5 });
  try {
    const reordered = { sourceIds: [...input.sourceIds], postId: input.postId, campaignId: input.campaignId, revision: input.revision, requestId: input.requestId };
    const results = await Promise.all([simulation.generate(state, input), simulation.generate(state, reordered)]);
    assert.equal(results[0], results[1]);
    assert.ok(Object.isFrozen(results[0].request.sourceIds));
    await assert.rejects(simulation.generate(state, { ...input, postId: state.posts[1].id }), /identificador/);
    const changed = structuredClone(state); changed.posts[0].text = "Another editor";
    await assert.rejects(simulation.generate(changed, input), /identificador/);
    await assert.rejects(simulation.generate(state, input, { mode: "error" }), /identificador/);
  } finally { simulation.clear(); }
});

test("missing, cross-product and non-campaign sources, incompatible destination and stale revision are rejected", async () => {
  const state = fixture(), input = request(state), simulation = createTextSimulation({ latencyMs: 0 });
  try {
    await assert.rejects(simulation.generate(state, { ...input, sourceIds: [] }), /material/);
    await assert.rejects(simulation.generate(state, { ...input, sourceIds: ["missing"] }), /material/);
    await assert.rejects(simulation.generate(state, { ...input, sourceIds: [state.sources[1].id] }), /material/);
    const foreign = structuredClone(state); foreign.campaigns[0].sourceIds.push(foreign.sources[1].id);
    await assert.rejects(simulation.generate(foreign, { ...input, sourceIds: [foreign.sources[1].id] }), /producto/);
    const incompatible = structuredClone(state); incompatible.accounts[0].productIds = [];
    await assert.rejects(simulation.generate(incompatible, input), /cuenta/);
    await assert.rejects(simulation.generate(state, { ...input, revision: state.revision - 1 }), /cambió/);
    const ready = structuredClone(state); ready.posts[0].status = "ready";
    await assert.rejects(simulation.generate(ready, input), /borrador/);
  } finally { simulation.clear(); }
});

test("simulated errors, timeout, cancellation and malformed results never change the workspace", async () => {
  const state = fixture(), before = structuredClone(state), simulation = createTextSimulation({ latencyMs: 10, timeoutMs: 25 });
  try {
    for (const mode of ["error", "timeout", "malformed-text", "malformed-destination"] as const)
      await assert.rejects(simulation.generate(state, request(state, 0, mode), { mode }), /simulad|respuesta/i);
    const controller = new AbortController();
    const pending = simulation.generate(state, request(state, 0, "abort"), { signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, /cancelada/);
    assert.deepEqual(state, before);
  } finally { simulation.clear(); }
});

test("saving after external edits and generation-time mutations is rejected; original schedule is preserved", async () => {
  const state = fixture(); state.posts[0].scheduledAt = "2026-11-01T13:00:00.000Z";
  const simulation = createTextSimulation({ latencyMs: 5 });
  try {
    const result = await simulation.generate(state, request(state));
    assert.equal(simulation.prepareSave(state, result, "Edited").command.data.scheduledAt, state.posts[0].scheduledAt);
    assert.throws(() => simulation.prepareSave(state, result, "Edited again"), /ya se preparó/);
    const changed = structuredClone(state); changed.posts[0].text = "Saved elsewhere";
    assert.throws(() => simulation.prepareSave(changed, result, "Edited"), /cambió/);
    assert.throws(() => simulation.prepareSave(state, { ...result }, "Edited"), /respuesta/);
    const pending = simulation.generate(state, request(state, 0, "mutation"));
    state.posts[0].text = "Changed while waiting";
    await assert.rejects(pending, /cambió/);
  } finally { simulation.clear(); }
});

test("bounded session expiry, capacity, output size and clear reject retained or pending work", async () => {
  let now = 1000;
  const state = fixture(), simulation = createTextSimulation({ latencyMs: 0, now: () => now });
  try {
    const result = await simulation.generate(state, request(state));
    assert.equal(result.expiresAt - result.createdAt, TEXT_SIMULATION_LIMITS.ttlMs);
    for (let i = 1; i < TEXT_SIMULATION_LIMITS.maxRequests; i++)
      await simulation.generate(state, request(state, 0, `capacity-${i}`));
    await assert.rejects(simulation.generate(state, request(state, 0, "overflow")), /sesión/);
    now += TEXT_SIMULATION_LIMITS.ttlMs;
    assert.throws(() => simulation.prepareSave(state, result, "Edited"), /venció/);
    await simulation.generate(state, request(state, 0, "after-expiry"));
    simulation.clear();
    const tooLong = structuredClone(state); tooLong.sources[0].text = "x".repeat(20_001);
    await assert.rejects(simulation.generate(tooLong, request(tooLong, 0, "large-output")), /respuesta/);
    const oversized = structuredClone(state); oversized.products[0].description = "x".repeat(TEXT_SIMULATION_LIMITS.maxInputBytes);
    await assert.rejects(simulation.generate(oversized, request(oversized, 0, "large-input")), /tamaño/);
    const pending = simulation.generate(state, request(state, 0, "clear")); simulation.clear();
    await assert.rejects(pending, /cancelada/);
  } finally { simulation.clear(); }
});
