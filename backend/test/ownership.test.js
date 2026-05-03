import assert from "node:assert/strict";
import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { signToken } from "../utils.js";

// ─── helpers ────────────────────────────────────────────────────────────────

function makeServer(app) {
  const server = app.listen(0);
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

async function closeServer(server) {
  await new Promise((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  );
}

async function apiFetch(baseUrl, path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await response.json().catch(() => ({}));
  return { response, body: json };
}

async function runCase(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

// ─── tokens ─────────────────────────────────────────────────────────────────

const tokenA = signToken({ id: "system-head-A", role: "system_head", email: "a@iith.ac.in" });
const tokenB = signToken({ id: "system-head-B", role: "system_head", email: "b@iith.ac.in" });
const tokenUserA = signToken({ id: "user-A", role: "user", email: "ua@iith.ac.in" });
const tokenUserB = signToken({ id: "user-B", role: "user", email: "ub@iith.ac.in" });

// ─── mini route builders ─────────────────────────────────────────────────────
//
// Each mini app replicates only the ownership-check logic from the real route.
// The DB call is replaced with an inline fake that returns a fixed record.
// requireAuth + requireRole are the real middleware — JWT verification is real.

function makeEventApp({ eventOwnerId }) {
  const app = express();
  app.use(express.json());

  // mirrors: GET /:eventId in events.js
  // findEventByIdForSystemHead(eventId, systemHeadId) returns null when not the owner
  app.get("/events/:eventId", requireAuth, requireRole("system_head"), (req, res) => {
    const requestingId = req.auth.sub;
    // fake DB: the event exists but belongs to eventOwnerId
    const event = requestingId === eventOwnerId
      ? { id: req.params.eventId, name: "Fake Event", createdBySystemHeadId: eventOwnerId }
      : null;

    if (!event) return res.status(404).json({ message: "Event not found" });
    return res.json({ event });
  });

  return app;
}

function makeDeleteFixedApp({ paymentOwnerId }) {
  const app = express();
  app.use(express.json());

  // mirrors: DELETE /fixed-payment-requests/:id in delete-payment-request.js
  app.delete(
    "/fixed-payment-requests/:id",
    requireAuth,
    requireRole("system_head"),
    (req, res) => {
      const requestingId = req.auth.sub;
      // fake DB: payment request exists but belongs to paymentOwnerId
      const paymentRequest = { id: req.params.id, createdBySystemHeadId: paymentOwnerId };

      if (paymentRequest.createdBySystemHeadId !== requestingId) {
        return res.status(403).json({
          message: "Forbidden: Cannot delete payment request created by another system head",
        });
      }

      return res.json({ message: "Fixed payment request deleted successfully." });
    }
  );

  return app;
}

function makeDeleteOneTimeApp({ paymentOwnerId }) {
  const app = express();
  app.use(express.json());

  // mirrors: DELETE /one-time-payment-requests/:id in delete-payment-request.js
  app.delete(
    "/one-time-payment-requests/:id",
    requireAuth,
    requireRole("system_head"),
    (req, res) => {
      const requestingId = req.auth.sub;
      const paymentRequest = { id: req.params.id, createdBySystemHeadId: paymentOwnerId };

      if (paymentRequest.createdBySystemHeadId !== requestingId) {
        return res.status(403).json({
          message: "Forbidden: Cannot delete payment request created by another system head",
        });
      }

      return res.json({ message: "One-time payment request deleted successfully." });
    }
  );

  return app;
}

function makeVerifyStatusApp({ paymentUserId }) {
  const app = express();
  app.use(express.json());

  // mirrors: POST /verify-status in user-payments.js — only the ownership check
  // (we stop before the ICICI status call since that needs a live gateway)
  app.post("/verify-status", requireAuth, requireRole("user"), (req, res) => {
    const requestingUserId = req.auth.sub;
    // fake DB: payment record exists but student.userId is paymentUserId
    const paymentRecord = {
      id: "payment-record-1",
      status: "pending",
      student: { userId: paymentUserId, roll_no: "CS21BTECH11001" },
      paymentRequestId: "req-1",
    };

    if (String(paymentRecord.student.userId) !== String(requestingUserId)) {
      return res.status(403).json({ message: "You are not allowed to verify this payment" });
    }

    // ownership passed — return a stub (no ICICI call in this test)
    return res.json({ status: "pending", paymentRecord, message: "Ownership check passed" });
  });

  return app;
}

// ─── tests ───────────────────────────────────────────────────────────────────

// 1. System Head A tries to view an event that belongs to System Head B → 404
await runCase("system head cannot view another system head's event", async () => {
  const { server, baseUrl } = makeServer(makeEventApp({ eventOwnerId: "system-head-B" }));
  try {
    const { response, body } = await apiFetch(baseUrl, "/events/event-123", { token: tokenA });
    assert.equal(response.status, 404);
    assert.equal(body.message, "Event not found");
  } finally {
    await closeServer(server);
  }
});

// 2. System Head A can view their own event → 200
await runCase("system head can view their own event", async () => {
  const { server, baseUrl } = makeServer(makeEventApp({ eventOwnerId: "system-head-A" }));
  try {
    const { response, body } = await apiFetch(baseUrl, "/events/event-123", { token: tokenA });
    assert.equal(response.status, 200);
    assert.equal(body.event.id, "event-123");
  } finally {
    await closeServer(server);
  }
});

// 3. System Head A tries to delete a fixed payment request owned by System Head B → 403
await runCase("system head cannot delete another system head's fixed payment request", async () => {
  const { server, baseUrl } = makeServer(makeDeleteFixedApp({ paymentOwnerId: "system-head-B" }));
  try {
    const { response, body } = await apiFetch(baseUrl, "/fixed-payment-requests/req-abc", {
      method: "DELETE",
      token: tokenA,
    });
    assert.equal(response.status, 403);
    assert.equal(body.message, "Forbidden: Cannot delete payment request created by another system head");
  } finally {
    await closeServer(server);
  }
});

// 4. System Head A can delete their own fixed payment request → 200
await runCase("system head can delete their own fixed payment request", async () => {
  const { server, baseUrl } = makeServer(makeDeleteFixedApp({ paymentOwnerId: "system-head-A" }));
  try {
    const { response, body } = await apiFetch(baseUrl, "/fixed-payment-requests/req-abc", {
      method: "DELETE",
      token: tokenA,
    });
    assert.equal(response.status, 200);
    assert.equal(body.message, "Fixed payment request deleted successfully.");
  } finally {
    await closeServer(server);
  }
});

// 5. System Head A tries to delete a one-time payment request owned by System Head B → 403
await runCase("system head cannot delete another system head's one-time payment request", async () => {
  const { server, baseUrl } = makeServer(makeDeleteOneTimeApp({ paymentOwnerId: "system-head-B" }));
  try {
    const { response, body } = await apiFetch(baseUrl, "/one-time-payment-requests/req-xyz", {
      method: "DELETE",
      token: tokenA,
    });
    assert.equal(response.status, 403);
    assert.equal(body.message, "Forbidden: Cannot delete payment request created by another system head");
  } finally {
    await closeServer(server);
  }
});

// 6. System Head A can delete their own one-time payment request → 200
await runCase("system head can delete their own one-time payment request", async () => {
  const { server, baseUrl } = makeServer(makeDeleteOneTimeApp({ paymentOwnerId: "system-head-A" }));
  try {
    const { response, body } = await apiFetch(baseUrl, "/one-time-payment-requests/req-xyz", {
      method: "DELETE",
      token: tokenA,
    });
    assert.equal(response.status, 200);
    assert.equal(body.message, "One-time payment request deleted successfully.");
  } finally {
    await closeServer(server);
  }
});

// 7. User A tries to verify a payment that belongs to User B → 403
await runCase("user cannot verify another user's payment", async () => {
  const { server, baseUrl } = makeServer(makeVerifyStatusApp({ paymentUserId: "user-B" }));
  try {
    const { response, body } = await apiFetch(baseUrl, "/verify-status", {
      method: "POST",
      token: tokenUserA,
      body: { paymentRecordId: "payment-record-1" },
    });
    assert.equal(response.status, 403);
    assert.equal(body.message, "You are not allowed to verify this payment");
  } finally {
    await closeServer(server);
  }
});

// 8. User A can verify their own payment → 200 (ownership check passes)
await runCase("user can verify their own payment", async () => {
  const { server, baseUrl } = makeServer(makeVerifyStatusApp({ paymentUserId: "user-A" }));
  try {
    const { response, body } = await apiFetch(baseUrl, "/verify-status", {
      method: "POST",
      token: tokenUserA,
      body: { paymentRecordId: "payment-record-1" },
    });
    assert.equal(response.status, 200);
    assert.equal(body.message, "Ownership check passed");
  } finally {
    await closeServer(server);
  }
});

if (!process.exitCode) {
  console.log("All ownership tests passed.");
}
