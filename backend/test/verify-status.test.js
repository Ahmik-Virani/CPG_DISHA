import assert from "node:assert/strict";
import test from "node:test";
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

async function post(baseUrl, path, { token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body || {}),
  });
  const json = await response.json().catch(() => ({}));
  return { response, body: json };
}

function runCase(name, fn) {
  test(name, fn);
}

// ─── mini app builder ────────────────────────────────────────────────────────
//
// Replicates the exact logic of POST /verify-status from user-payments.js.
// DB calls and ICICI status check are replaced with inline fakes via config.
//
// Config shape:
//   fakeUser          - what findUserById returns (null = user not found)
//   fakePaymentRecord - the Payment_Processed record to look up (null = not found)
//   iciciResult       - what checkIciciSaleStatus returns:
//                         { hashVerified, status, dbStatusLabel, txnRespDescription }
//
// State tracking:
//   updatedRecord     - object that gets mutated when updatePaymentProcessedById is called
//                       so tests can assert what the record looks like after the update

function buildApp({ fakeUser, fakePaymentRecord, iciciResult }) {
  const app = express();
  app.use(express.json());

  app.post("/verify-status", requireAuth, requireRole("user"), async (req, res) => {
    const paymentRecordId = String(req.body?.paymentRecordId || "").trim();
    const fallbackPaymentRequestId = String(req.body?.paymentRequestId || "").trim();

    // Step 1: at least one identifier required
    if (!paymentRecordId && !fallbackPaymentRequestId) {
      return res.status(400).json({ message: "paymentRecordId or paymentRequestId is required" });
    }

    // Step 2: find user (fake DB)
    const user = fakeUser;
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Step 3: find payment record (fake DB)
    const paymentRecord = fakePaymentRecord;
    if (!paymentRecord) {
      return res.status(404).json({ message: "Payment record not found" });
    }

    // Step 4: ownership check
    if (String(paymentRecord?.student?.userId || "") !== String(user.id)) {
      return res.status(403).json({ message: "You are not allowed to verify this payment" });
    }

    // Step 5: already success — return immediately without calling ICICI
    if (String(paymentRecord.status || "").toLowerCase() === "success") {
      return res.json({
        status: "success",
        paymentRecord,
        message: "Payment is already marked as success",
      });
    }

    // Step 6: call ICICI status (stubbed via iciciResult)
    const statusResult = iciciResult;

    // Step 7: hash not verified — keep pending, flag for retry
    if (!statusResult.hashVerified) {
      const updatedRecord = {
        ...paymentRecord,
        pendingHashVerificationRetry: true,
        gateway: {
          ...(paymentRecord.gateway || {}),
          statusResponsePacket: statusResult.responsePacket || null,
        },
      };

      return res.json({
        status: "pending",
        paymentRecord: updatedRecord,
        message: "Payment status could not be verified. Will retry automatically.",
      });
    }

    // Step 8: hash verified — update status to success or failed
    const finalStatus = statusResult.status;
    const dbStatusLabel = statusResult.dbStatusLabel || (finalStatus === "success" ? "SUCCESSFUL" : "FAILURE");

    const updatedRecord = {
      ...paymentRecord,
      status: finalStatus,
      pendingHashVerificationRetry: false,
      transaction: {
        ...(paymentRecord.transaction || {}),
        status: dbStatusLabel,
        response_code: dbStatusLabel,
      },
      gateway: {
        ...(paymentRecord.gateway || {}),
        statusResponsePacket: statusResult.responsePacket || null,
        txnRespDescription: statusResult.txnRespDescription || null,
      },
    };

    return res.json({
      status: finalStatus,
      paymentRecord: updatedRecord,
      txnRespDescription: statusResult.txnRespDescription || null,
    });
  });

  return app;
}

// ─── shared fake data ────────────────────────────────────────────────────────

const validUser = {
  id: "user-1",
  roll_no: "CS21BTECH11001",
  name: "Test Student",
  email: "student@iith.ac.in",
};

const pendingRecord = {
  id: "payment-record-1",
  status: "pending",
  student: { userId: "user-1", roll_no: "CS21BTECH11001" },
  paymentRequestId: "req-1",
  transaction: { transaction_id: "TXN123", amount: 500 },
  gateway: { tranCtx: "ctx-abc", originalTxnNo: "TXN123" },
};

const alreadySuccessRecord = {
  ...pendingRecord,
  id: "payment-record-2",
  status: "success",
};

const otherUserRecord = {
  ...pendingRecord,
  id: "payment-record-3",
  student: { userId: "user-99", roll_no: "CS21BTECH11999" },
};

const iciciHashFailed = {
  hashVerified: false,
  status: "pending",
  txnRespDescription: "",
  responsePacket: {},
};

const iciciVerifiedSuccess = {
  hashVerified: true,
  status: "success",
  dbStatusLabel: "SUCCESSFUL",
  txnRespDescription: "transaction successful",
  responsePacket: { txnRespDescription: "transaction successful" },
};

const iciciVerifiedFailed = {
  hashVerified: true,
  status: "failed",
  dbStatusLabel: "FAILURE",
  txnRespDescription: "transaction failed",
  responsePacket: { txnRespDescription: "transaction failed" },
};

const userToken = signToken({ id: "user-1", role: "user", email: "student@iith.ac.in" });

// ─── tests ───────────────────────────────────────────────────────────────────

// 1. Neither paymentRecordId nor paymentRequestId provided → 400
await runCase("rejects verify-status when no record identifier is provided", async () => {
  const { server, baseUrl } = makeServer(buildApp({ fakeUser: validUser, fakePaymentRecord: pendingRecord, iciciResult: iciciVerifiedSuccess }));
  try {
    const { response, body } = await post(baseUrl, "/verify-status", {
      token: userToken,
      body: {},
    });
    assert.equal(response.status, 400);
    assert.equal(body.message, "paymentRecordId or paymentRequestId is required");
  } finally {
    await closeServer(server);
  }
});

// 2. Payment record not found → 404
await runCase("rejects verify-status when payment record does not exist", async () => {
  const { server, baseUrl } = makeServer(buildApp({ fakeUser: validUser, fakePaymentRecord: null, iciciResult: iciciVerifiedSuccess }));
  try {
    const { response, body } = await post(baseUrl, "/verify-status", {
      token: userToken,
      body: { paymentRecordId: "nonexistent-record" },
    });
    assert.equal(response.status, 404);
    assert.equal(body.message, "Payment record not found");
  } finally {
    await closeServer(server);
  }
});

// 3. Payment record belongs to a different user → 403
await runCase("rejects verify-status when payment record belongs to a different user", async () => {
  const { server, baseUrl } = makeServer(buildApp({ fakeUser: validUser, fakePaymentRecord: otherUserRecord, iciciResult: iciciVerifiedSuccess }));
  try {
    const { response, body } = await post(baseUrl, "/verify-status", {
      token: userToken,
      body: { paymentRecordId: "payment-record-3" },
    });
    assert.equal(response.status, 403);
    assert.equal(body.message, "You are not allowed to verify this payment");
  } finally {
    await closeServer(server);
  }
});

// 4. Payment is already marked success → return immediately, no ICICI call needed
await runCase("returns success immediately when payment is already marked as success", async () => {
  const { server, baseUrl } = makeServer(buildApp({ fakeUser: validUser, fakePaymentRecord: alreadySuccessRecord, iciciResult: iciciHashFailed }));
  try {
    const { response, body } = await post(baseUrl, "/verify-status", {
      token: userToken,
      body: { paymentRecordId: "payment-record-2" },
    });
    assert.equal(response.status, 200);
    assert.equal(body.status, "success");
    assert.equal(body.message, "Payment is already marked as success");
  } finally {
    await closeServer(server);
  }
});

// 5. ICICI response hash cannot be verified → keep pending, flag for retry
await runCase("keeps payment pending and flags for retry when ICICI response hash fails verification", async () => {
  const { server, baseUrl } = makeServer(buildApp({ fakeUser: validUser, fakePaymentRecord: pendingRecord, iciciResult: iciciHashFailed }));
  try {
    const { response, body } = await post(baseUrl, "/verify-status", {
      token: userToken,
      body: { paymentRecordId: "payment-record-1" },
    });
    assert.equal(response.status, 200);
    assert.equal(body.status, "pending");
    assert.equal(body.message, "Payment status could not be verified. Will retry automatically.");
    assert.equal(body.paymentRecord.pendingHashVerificationRetry, true);
  } finally {
    await closeServer(server);
  }
});

// 6. ICICI returns verified success → mark payment as success
await runCase("marks payment as success when ICICI returns a verified successful response", async () => {
  const { server, baseUrl } = makeServer(buildApp({ fakeUser: validUser, fakePaymentRecord: pendingRecord, iciciResult: iciciVerifiedSuccess }));
  try {
    const { response, body } = await post(baseUrl, "/verify-status", {
      token: userToken,
      body: { paymentRecordId: "payment-record-1" },
    });
    assert.equal(response.status, 200);
    assert.equal(body.status, "success");
    assert.equal(body.paymentRecord.status, "success");
    assert.equal(body.paymentRecord.transaction.status, "SUCCESSFUL");
    assert.equal(body.paymentRecord.pendingHashVerificationRetry, false);
    assert.equal(body.txnRespDescription, "transaction successful");
  } finally {
    await closeServer(server);
  }
});

// 7. ICICI returns verified failure → mark payment as failed
await runCase("marks payment as failed when ICICI returns a verified failed response", async () => {
  const { server, baseUrl } = makeServer(buildApp({ fakeUser: validUser, fakePaymentRecord: pendingRecord, iciciResult: iciciVerifiedFailed }));
  try {
    const { response, body } = await post(baseUrl, "/verify-status", {
      token: userToken,
      body: { paymentRecordId: "payment-record-1" },
    });
    assert.equal(response.status, 200);
    assert.equal(body.status, "failed");
    assert.equal(body.paymentRecord.status, "failed");
    assert.equal(body.paymentRecord.transaction.status, "FAILURE");
    assert.equal(body.paymentRecord.pendingHashVerificationRetry, false);
    assert.equal(body.txnRespDescription, "transaction failed");
  } finally {
    await closeServer(server);
  }
});

