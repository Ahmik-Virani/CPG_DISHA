import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { signToken } from "../utils.js";

function createTestServer() {
  const app = express();
  app.use(express.json());

  app.get("/protected", requireAuth, (req, res) => {
    return res.json({
      ok: true,
      auth: req.auth,
    });
  });

  app.get("/user-only", requireAuth, requireRole("user"), (_req, res) => {
    return res.json({ ok: true, route: "user-only" });
  });

  app.get("/system-head-only", requireAuth, requireRole("system_head"), (_req, res) => {
    return res.json({ ok: true, route: "system-head-only" });
  });

  app.get("/admin-only", requireAuth, requireRole("admin"), (_req, res) => {
    return res.json({ ok: true, route: "admin-only" });
  });

  const server = app.listen(0);

  return {
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
  };
}

async function requestJson(baseUrl, path, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function closeServer(server) {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function runCase(name, fn) {
  test(name, fn);
}

await runCase("protected route rejects missing token", async () => {
  const { server, baseUrl } = createTestServer();
  try {
    const { response, body } = await requestJson(baseUrl, "/protected");
    assert.equal(response.status, 401);
    assert.deepEqual(body, { message: "Missing access token" });
  } finally {
    await closeServer(server);
  }
});

await runCase("protected route rejects invalid token", async () => {
  const { server, baseUrl } = createTestServer();
  try {
    const { response, body } = await requestJson(baseUrl, "/protected", "definitely-not-a-real-token");
    assert.equal(response.status, 401);
    assert.deepEqual(body, { message: "Invalid or expired token" });
  } finally {
    await closeServer(server);
  }
});

await runCase("protected route accepts valid token", async () => {
  const { server, baseUrl } = createTestServer();
  const token = signToken({
    id: "user-1",
    role: "user",
    email: "user@example.com",
  });

  try {
    const { response, body } = await requestJson(baseUrl, "/protected", token);
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.auth.sub, "user-1");
    assert.equal(body.auth.role, "user");
    assert.equal(body.auth.email, "user@example.com");
  } finally {
    await closeServer(server);
  }
});

await runCase("user token is blocked from admin-only route", async () => {
  const { server, baseUrl } = createTestServer();
  const token = signToken({
    id: "user-1",
    role: "user",
    email: "user@example.com",
  });

  try {
    const { response, body } = await requestJson(baseUrl, "/admin-only", token);
    assert.equal(response.status, 403);
    assert.deepEqual(body, { message: "Forbidden" });
  } finally {
    await closeServer(server);
  }
});

await runCase("system head token is blocked from user-only route", async () => {
  const { server, baseUrl } = createTestServer();
  const token = signToken({
    id: "system-head-1",
    role: "system_head",
    email: "system.head@example.com",
  });

  try {
    const { response, body } = await requestJson(baseUrl, "/user-only", token);
    assert.equal(response.status, 403);
    assert.deepEqual(body, { message: "Forbidden" });
  } finally {
    await closeServer(server);
  }
});

await runCase("admin token is blocked from system-head-only route by exact-match role checks", async () => {
  const { server, baseUrl } = createTestServer();
  const token = signToken({
    id: "admin-1",
    role: "admin",
    email: "admin@example.com",
  });

  try {
    const { response, body } = await requestJson(baseUrl, "/system-head-only", token);
    assert.equal(response.status, 403);
    assert.deepEqual(body, { message: "Forbidden" });
  } finally {
    await closeServer(server);
  }
});

await runCase("admin token is accepted on admin-only route", async () => {
  const { server, baseUrl } = createTestServer();
  const token = signToken({
    id: "admin-1",
    role: "admin",
    email: "admin@example.com",
  });

  try {
    const { response, body } = await requestJson(baseUrl, "/admin-only", token);
    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true, route: "admin-only" });
  } finally {
    await closeServer(server);
  }
});

