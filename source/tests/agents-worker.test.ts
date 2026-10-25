import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { nativeApi } from "../server/worker.ts";

test("Worker owner session and bridge bearer remain separate; D1 pairing is durable and revocable", async t => {
  const sql = new DatabaseSync(":memory:");
  for (const name of ["0001_private.sql", "0002_studio.sql", "0003_studio_hosted.sql", "0004_studio_analysis.sql", "0005_studio_settings.sql", "0006_agents.sql", "0007_single_tenant_auth.sql", "0008_github_auth.sql", "0009_profile_account.sql"])
    sql.exec(readFileSync(new URL(`../migrations-d1/${name}`, import.meta.url), "utf8"));
  t.after(() => sql.close());
  const DB = {
    prepare(text) {
      let args = [];
      const statement = {
        bind(...values) { args = values; return statement; },
        execute() { const query = sql.prepare(text); return query.columns().length ? { success: true, results: query.all(...args), meta: { changes: 0 } } : { success: true, results: [], meta: { changes: Number(query.run(...args).changes) } }; },
        async run() { return statement.execute(); }, async all() { return statement.execute(); }, async first() { return statement.execute().results[0] ?? null; },
      };
      return statement;
    },
    async batch(statements) { sql.exec("BEGIN IMMEDIATE"); try { const result = statements.map(statement => statement.execute()); sql.exec("COMMIT"); return result; } catch (error) { sql.exec("ROLLBACK"); throw error; } },
  };
  const origin = "https://marker.aekr.io", mails = [], waits = [];
  const env = { DB, MARKER_ORIGIN: origin, MARKER_OWNER_EMAIL: "owner@example.invalid", MARKER_SENDER_EMAIL: "sender@example.invalid", MARKER_AUTH_SECRET: "synthetic-test-secret-at-least-thirty-two-characters", EMAIL: { async send(mail) { mails.push(mail); } } };
  const ctx = { waitUntil(job) { waits.push(job); } };
  async function call(path, data = undefined, extra = {}, method = data === undefined ? "GET" : "POST") {
    const response = await nativeApi(new Request(origin + path, { method, headers: { Origin: origin, "content-type": "application/json", "X-Marker-Auth": "1", "CF-Connecting-IP": "192.0.2.50", ...extra }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) }), env, ctx);
    await Promise.all(waits.splice(0));
    return response;
  }
  const cookie = (response, name) => response.headers.getSetCookie().find(value => value.startsWith(name + "="))?.split(";")[0] ?? "";
  assert.equal((await call("/api/agents")).status, 401);
  assert.equal((await call("/api/agents/connections", { name: "Unauthorized" })).status, 401);
  assert.equal((await call("/api/agents/bridge/heartbeat", { authMode: "chatgpt" })).status, 401);
  const challenge = await call("/api/auth/request", { email: env.MARKER_OWNER_EMAIL });
  const code = mails[0].text.match(/\b\d{8}\b/)[0];
  const verified = await call("/api/auth/verify", { code }, { Cookie: cookie(challenge, "__Host-marker_challenge") });
  const owner = cookie(verified, "__Host-marker_session");
  assert.ok(owner);
  const paired = await call("/api/agents/connections", { name: "Local runtime" }, { Cookie: owner });
  assert.equal(paired.status, 201);
  const { connection, token } = await paired.json();
  const stored = sql.prepare("SELECT document FROM marker_agent_connections WHERE id=?").get(connection.id).document;
  assert.equal(stored.includes(token), false);
  const identity = { authMode: "chatgpt", billingMode: "chatgpt_subscription", accountLabel: "fixture@example.invalid", model: "observed-model", capabilities: ["copy", "streaming"] };
  assert.equal((await call("/api/agents/bridge/heartbeat", identity, { Authorization: `Bearer ${token}` })).status, 200);
  assert.equal((await call("/api/agents", undefined, { Authorization: `Bearer ${token}` })).status, 401);
  assert.equal((await call("/api/studio", undefined, { Authorization: `Bearer ${token}` })).status, 401);
  const overview = await (await call("/api/agents", undefined, { Cookie: owner })).json();
  assert.equal(overview.connections[0].available, true);
  assert.equal(JSON.stringify(overview).includes("tokenHash"), false);
  assert.equal((await call(`/api/agents/connections/${connection.id}`, undefined, { Cookie: owner }, "DELETE")).status, 200);
  assert.equal((await call("/api/agents/bridge/heartbeat", identity, { Authorization: `Bearer ${token}` })).status, 401);
  assert.equal((await call("/api/agents/connections", { name: "Cross origin" }, { Cookie: owner, Origin: "https://other.example" })).status, 403);
});
