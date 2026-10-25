import test from "node:test";
import assert from "node:assert/strict";
import { hostedApi } from "../server/worker.ts";

const config = {
  url: "https://auth.example.com",
  key: "public-key-fixture",
  ownerId: "owner-fixture",
};
test("unconfigured hosted backend fails closed, anonymous and other identities cannot read or write", async () => {
  assert.equal(
    (
      await hostedApi(new Request("https://marker.example/api/workspace"), {
        url: "",
        key: "",
        ownerId: "",
      })
    ).status,
    503,
  );
  assert.equal(
    (
      await hostedApi(
        new Request("https://marker.example/api/workspace"),
        config,
      )
    ).status,
    401,
  );
  const original = globalThis.fetch;
  try {
    const paths: string[] = [];
    globalThis.fetch = async (input) => {
      paths.push(String(input));
      return Response.json({ id: "other-fixture" });
    };
    assert.equal(
      (
        await hostedApi(
          new Request("https://marker.example/api/workspace", {
            headers: { cookie: "__Host-marker=other-token" },
          }),
          config,
        )
      ).status,
      401,
    );
    assert.ok(paths.every((path) => path.endsWith("/auth/v1/user")));
    const nonOwnerWrite = new Request('https://marker.example/api/commands', { method: 'POST', headers: { Origin: 'https://marker.example', cookie: '__Host-marker=other-token', 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal((await hostedApi(nonOwnerWrite, config)).status, 401);
    assert.ok(paths.every((path) => path.endsWith('/auth/v1/user')));
    const request = new Request("https://marker.example/api/commands", {
      method: "POST",
      headers: {
        Origin: "https://evil.example",
        cookie: "__Host-marker=other-token",
      },
      body: "{}",
    });
    assert.equal((await hostedApi(request, config)).status, 403);
  } finally {
    globalThis.fetch = original;
  }
});
test("configured owner reads through Supabase and successful login returns HttpOnly cookie without browser tokens", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (input) =>
      String(input).includes("/token?")
        ? Response.json({
            access_token: "signed.owner.token",
            expires_in: 3600,
            user: { id: config.ownerId },
          })
        : String(input).endsWith("/auth/v1/user")
          ? Response.json({ id: config.ownerId })
          : Response.json([]);
    const response = await hostedApi(
      new Request("https://marker.example/api/workspace", {
        headers: { cookie: "__Host-marker=signed.owner.token" },
      }),
      config,
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).revision, 0);
    const login = await hostedApi(
      new Request("https://marker.example/api/login", {
        method: "POST",
        headers: {
          Origin: "https://marker.example",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "fixture@example.com",
          password: "fixture",
        }),
      }),
      config,
    );
    assert.equal(login.status, 200);
    assert.match(
      login.headers.get("Set-Cookie")!,
      /Secure; HttpOnly; SameSite=Strict/,
    );
    assert.deepEqual(await login.json(), { ok: true });
  } finally {
    globalThis.fetch = original;
  }
});
