import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCommand,
  emptyWorkspace,
  sourceInUse,
  type Workspace,
} from "../src/core/domain.ts";
import { editorialApi, readJson } from "../server/api.ts";
import { LocalRepository } from "../server/local.ts";
import { mkdtemp, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const product = { name: "Producto de prueba", status: "preparation" };
const account = {
  name: "Cuenta de prueba",
  platform: "LinkedIn",
  url: "https://example.com/profile",
  timezone: "America/New_York",
  productIds: [] as string[],
};
function fixture() {
  let state = emptyWorkspace();
  const run = (type: string, data: Record<string, unknown>) =>
    (state = applyCommand(state, { type, data }));
  run("product.save", product);
  const productId = state.products[0].id;
  run("account.save", { ...account, productIds: [productId] });
  const accountId = state.accounts[0].id;
  run("source.save", {
    productId,
    title: "Fuente literal",
    text: "  Hechos aprobados\n\n",
    declaredDate: "2026-10-22",
  });
  const sourceId = state.sources[0].id;
  return {
    get state() {
      return state;
    },
    run,
    productId,
    accountId,
    sourceId,
  };
}
function campaign(
  f: ReturnType<typeof fixture>,
  extra: Record<string, unknown> = {},
) {
  return f.run("campaign.create", {
    productId: f.productId,
    title: "Campaña de prueba",
    objective: "Explicar el producto",
    sourceIds: [f.sourceId],
    accountIds: [f.accountId],
    kind: "organic",
    ...extra,
  });
}

test("manual editorial cycle preserves original whitespace, source references and explicit result evidence", () => {
  const f = fixture();
  assert.equal(f.state.sources[0].text, "  Hechos aprobados\n\n");
  campaign(f);
  const post = f.state.posts[0];
  assert.equal(post.text, "");
  assert.ok(sourceInUse(f.state, f.sourceId));
  assert.throws(() => f.run("source.delete", { id: f.sourceId }), /campañas/);
  assert.throws(
    () =>
      f.run("source.save", {
        id: f.sourceId,
        productId: f.productId,
        title: "Cambio",
        text: "Changed",
      }),
    /asociado/,
  );
  f.run("post.save", {
    id: post.id,
    text: "  Texto manual aprobado\n",
    status: "ready",
    formatConfirmed: true,
    scheduledAt: "2026-11-01T13:00:00Z",
  });
  assert.equal(f.state.posts[0].text, "  Texto manual aprobado\n");
  assert.throws(
    () =>
      f.run("post.confirm", {
        id: post.id,
        status: "published",
        externalUrl: "https://example.com/post",
      }),
    /confirmación humana/,
  );
  f.run("post.confirm", {
    id: post.id,
    status: "published",
    externalUrl: "https://example.com/post",
    confirmed: true,
  });
  assert.equal(f.state.posts[0].status, "published");
  assert.equal(f.state.sources.length, 1);
  assert.notEqual(f.state.posts[0].text, "");
  assert.throws(() => f.run("post.delete", { id: post.id }), /Confirma/);
  f.run("post.delete", { id: post.id, confirmed: true });
  f.run("campaign.delete", { id: f.state.campaigns[0].id });
  f.run("source.delete", { id: f.sourceId });
  assert.equal(f.state.sources.length, 0);
  assert.equal(f.state.posts.length, 0);
});
test("shared account prevents equal absolute schedules across products and sources outlive one campaign", () => {
  const f = fixture();
  campaign(f);
  const first = f.state.posts[0];
  f.run("product.save", { ...product, name: "Segundo producto" });
  const secondProduct = f.state.products[1].id;
  f.run("account.save", {
    ...account,
    id: f.accountId,
    productIds: [f.productId, secondProduct],
  });
  f.run("source.save", {
    productId: secondProduct,
    title: "Otra fuente",
    text: "Hecho aprobado",
  });
  campaign(f, { productId: secondProduct, sourceIds: [f.state.sources[1].id] });
  const second = f.state.posts[1];
  f.run("post.save", {
    id: first.id,
    text: "Uno",
    status: "draft",
    scheduledAt: "2026-11-01T13:00:00Z",
  });
  assert.throws(
    () =>
      f.run("post.save", {
        id: second.id,
        text: "Dos",
        status: "draft",
        scheduledAt: "2026-11-01T08:00:00-05:00",
      }),
    /horario/,
  );
  campaign(f);
  const sharedCampaign = f.state.campaigns[2];
  f.run("post.delete", { id: f.state.posts[0].id, confirmed: true });
  f.run("campaign.delete", { id: f.state.campaigns[0].id });
  assert.equal(sharedCampaign.sourceIds[0], f.sourceId);
  assert.ok(sourceInUse(f.state, f.sourceId));
  assert.throws(() => f.run("source.delete", { id: f.sourceId }), /campañas/);
});
test("relationships reject foreign sources, incompatible accounts and destructive dependency changes", () => {
  const f = fixture();
  f.run("product.save", { ...product, name: "Otro" });
  const other = f.state.products[1].id;
  assert.throws(() => campaign(f, { productId: other }), /otro producto/);
  f.run("source.save", {
    productId: other,
    title: "Ajena",
    text: "Otro texto",
  });
  assert.throws(
    () => campaign(f, { productId: other, sourceIds: [f.state.sources[1].id] }),
    /no admite/,
  );
  campaign(f);
  assert.throws(
    () => f.run("account.delete", { id: f.accountId }),
    /vinculadas/,
  );
  assert.throws(
    () =>
      f.run("account.save", {
        ...account,
        id: f.accountId,
        productIds: [other],
      }),
    /desvincular/,
  );
  assert.throws(
    () => f.run("product.delete", { id: f.productId }),
    /vinculados/,
  );
  assert.throws(
    () => f.run("campaign.delete", { id: f.state.campaigns[0].id }),
    /publicaciones/,
  );
});
test("paid plans always start paused, require explicit budget/currency and cannot activate spending", () => {
  const f = fixture();
  assert.throws(() => campaign(f, { kind: "paid" }), /moneda ISO/);
  campaign(f, { kind: "paid", currency: "USD", budget: "10.50" });
  assert.equal(f.state.campaigns[0].status, "paused");
  f.run("post.save", {
    id: f.state.posts[0].id,
    text: "Propuesta",
    status: "ready",
    formatConfirmed: true,
  });
  assert.throws(
    () =>
      f.run("post.confirm", {
        id: f.state.posts[0].id,
        status: "published",
        externalUrl: "https://example.com",
        confirmed: true,
      }),
    /pausada/,
  );
});
test("readiness cannot be forged for empty/unreviewed or multimedia-only destinations", () => {
  const f = fixture();
  campaign(f);
  const id = f.state.posts[0].id;
  assert.throws(
    () =>
      f.run("post.save", {
        id,
        text: "",
        status: "ready",
        formatConfirmed: true,
      }),
    /text/,
  );
  assert.throws(
    () => f.run("post.save", { id, text: "Texto", status: "ready" }),
    /Confirma/,
  );
  f.run("account.save", {
    ...account,
    name: "Instagram de prueba",
    platform: "Instagram",
    productIds: [f.productId],
  });
  campaign(f, { accountIds: [f.state.accounts[1].id] });
  assert.throws(
    () =>
      f.run("post.save", {
        id: f.state.posts[1].id,
        text: "Texto",
        status: "ready",
        formatConfirmed: true,
      }),
    /multimedia/,
  );
});
test("invalid input never mutates the prior state or invents records", () => {
  const f = fixture(),
    original = structuredClone(f.state);
  for (const url of [
    "javascript:alert(1)",
    "https://user:password@example.com",
  ])
    assert.throws(() => f.run("product.save", { ...product, url }));
  assert.throws(
    () =>
      f.run("source.save", {
        productId: f.productId,
        title: "Invalid",
        text: "x",
        declaredDate: "2026-99-99",
      }),
    /Fecha/,
  );
  assert.throws(
    () =>
      f.run("source.save", {
        productId: f.productId,
        title: "Binary",
        text: "x\0y",
      }),
    /binario/,
  );
  assert.throws(
    () => f.run("campaign.create", { id: "duplicate" }),
    /identificador/,
  );
  assert.deepEqual(f.state, original);
  assert.deepEqual(emptyWorkspace().products, []);
});
test("bounded API rejects non-JSON, oversized streaming payloads and cross-origin writes", async () => {
  const repo = {
    read: async () => emptyWorkspace(),
    save: async () => {
      throw new Error("must not write");
    },
  };
  const req = (body: string, extra = {}) =>
    new Request("http://127.0.0.1:5174/api/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...extra },
      body,
    });
  assert.equal(
    (await editorialApi(req("{}", { Origin: "https://evil.example" }), repo))
      .status,
    403,
  );
  assert.equal(
    (await editorialApi(req("x".repeat(300_001)), repo)).status,
    413,
  );
  assert.equal(
    (await editorialApi(req("{}", { "Content-Type": "text/plain" }), repo))
      .status,
    415,
  );
  await assert.rejects(readJson(req("{broken")), /JSON/);
});
test("concurrent local writes reject stale revisions, persist across instances and never overwrite corrupt state", async () => {
  const dir = await mkdtemp(join(tmpdir(), "marker-editorial-"));
  try {
    const path = join(dir, "state.json"),
      repo = new LocalRepository(path);
    const next = applyCommand(emptyWorkspace(), {
      type: "product.save",
      data: product,
    });
    const results = await Promise.allSettled([
      repo.save(next, 0),
      repo.save(next, 0),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal((await new LocalRepository(path).read()).products.length, 1);
    const body = JSON.stringify({
      revision: 0,
      type: "product.save",
      data: product,
    });
    const response = await editorialApi(
      new Request("http://localhost/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }),
      repo,
    );
    assert.equal(response.status, 409);
    assert.equal(JSON.parse(await readFile(path, "utf8")).revision, 1);
    await writeFile(path, "{corrupt", "utf8");
    await assert.rejects(repo.read());
    await assert.rejects(repo.save(next, 0));
    assert.equal(await readFile(path, "utf8"), "{corrupt");
  } finally {
    await rm(join(dir, "state.json"), { force: true });
    await rmdir(dir);
  }
});
