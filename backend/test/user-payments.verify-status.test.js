import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import express from "express";
import jwt from "jsonwebtoken";

import { JWT_SECRET } from "../config.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { createVerifyUserPaymentStatusHandler } from "../routes/user-payments.js";

function buildAuthHeader(overrides = {}) {
  const token = jwt.sign(
    {
      sub: "user-1",
      role: "user",
      ...overrides,
    },
    JWT_SECRET
  );

  return `Bearer ${token}`;
}

function mergePaymentRecord(baseRecord, patch) {
  return {
    ...baseRecord,
    ...patch,
    transaction: patch.transaction
      ? {
          ...(baseRecord.transaction || {}),
          ...patch.transaction,
        }
      : baseRecord.transaction,
    gateway: patch.gateway
      ? {
          ...(baseRecord.gateway || {}),
          ...patch.gateway,
        }
      : baseRecord.gateway,
  };
}

async function startTestServer(handler) {
  const app = express();
  app.use(express.json());
  app.post("/user-payments/verify-status", requireAuth, requireRole("user"), handler);

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;

  return {
    url,
    async close() {
      server.close();
      await once(server, "close");
    },
  };
}

test("POST /user-payments/verify-status keeps a transaction pending until hash verification succeeds", async () => {
  const paymentRecord = {
    id: "payment-1",
    status: "pending",
    paymentRequestId: "request-1",
    student: {
      userId: "user-1",
    },
    transaction: {
      transaction_id: "merchant-txn-1",
      response_code: "PENDING",
    },
    gateway: {
      tranCtx: "ctx-1",
    },
  };

  const updateCalls = [];
  const paymentRequestStatusUpdates = [];

  const handler = createVerifyUserPaymentStatusHandler({
    findUserById: async (userId) => ({
      id: userId,
      role: "user",
    }),
    findPaymentProcessedById: async (paymentRecordId) =>
      paymentRecordId === paymentRecord.id ? paymentRecord : null,
    listPaymentProcessedByUserId: async () => [],
    checkIciciSaleStatus: async () => ({
      hashVerified: false,
      status: "success",
      requestPacket: { transactionType: "STATUS" },
      responsePacket: { txnRespDescription: "Transaction Successful" },
      txnRespDescription: "Transaction Successful",
    }),
    updatePaymentProcessedById: async (paymentRecordId, patch) => {
      updateCalls.push({ paymentRecordId, patch });
      return mergePaymentRecord(paymentRecord, patch);
    },
    updatePaymentRequestStatusById: async (...args) => {
      paymentRequestStatusUpdates.push(args);
      return null;
    },
  });

  const server = await startTestServer(handler);

  try {
    const response = await fetch(`${server.url}/user-payments/verify-status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildAuthHeader(),
      },
      body: JSON.stringify({
        paymentRecordId: paymentRecord.id,
      }),
    });

    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.status, "pending");
    assert.equal(updateCalls.length, 1);
    assert.equal(paymentRequestStatusUpdates.length, 0);
    assert.equal(updateCalls[0].paymentRecordId, paymentRecord.id);
    assert.equal(updateCalls[0].patch.pendingHashVerificationRetry, true);
    assert.equal("status" in updateCalls[0].patch, false);
    assert.equal(body.paymentRecord.pendingHashVerificationRetry, true);
    assert.equal(body.paymentRecord.gateway.originalTxnNo, "ctx-1");
  } finally {
    await server.close();
  }
});

test("POST /user-payments/verify-status marks a transaction successful once hash verification succeeds", async () => {
  const paymentRecord = {
    id: "payment-2",
    status: "pending",
    paymentRequestId: "request-2",
    student: {
      userId: "user-1",
    },
    transaction: {
      transaction_id: "merchant-txn-2",
      response_code: "PENDING",
    },
    gateway: {
      tranCtx: "ctx-2",
    },
  };

  const updateCalls = [];
  const paymentRequestStatusUpdates = [];

  const handler = createVerifyUserPaymentStatusHandler({
    findUserById: async (userId) => ({
      id: userId,
      role: "user",
    }),
    findPaymentProcessedById: async (paymentRecordId) =>
      paymentRecordId === paymentRecord.id ? paymentRecord : null,
    listPaymentProcessedByUserId: async () => [],
    checkIciciSaleStatus: async () => ({
      hashVerified: true,
      status: "success",
      dbStatusLabel: "SUCCESSFUL",
      statusSignal: "SUC",
      requestPacket: { transactionType: "STATUS" },
      responsePacket: { txnRespDescription: "Transaction Successful" },
      txnRespDescription: "Transaction Successful",
    }),
    updatePaymentProcessedById: async (paymentRecordId, patch) => {
      updateCalls.push({ paymentRecordId, patch });
      return mergePaymentRecord(paymentRecord, patch);
    },
    updatePaymentRequestStatusById: async (...args) => {
      paymentRequestStatusUpdates.push(args);
      return {
        id: paymentRecord.paymentRequestId,
        status: args[1],
      };
    },
  });

  const server = await startTestServer(handler);

  try {
    const response = await fetch(`${server.url}/user-payments/verify-status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildAuthHeader(),
      },
      body: JSON.stringify({
        paymentRecordId: paymentRecord.id,
      }),
    });

    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.status, "success");
    assert.equal(updateCalls.length, 1);
    assert.deepEqual(paymentRequestStatusUpdates, [[paymentRecord.paymentRequestId, "success"]]);
    assert.equal(updateCalls[0].paymentRecordId, paymentRecord.id);
    assert.equal(updateCalls[0].patch.status, "success");
    assert.equal(updateCalls[0].patch.pendingHashVerificationRetry, false);
    assert.equal(updateCalls[0].patch.transaction.status, "SUCCESSFUL");
    assert.equal(body.paymentRecord.status, "success");
    assert.equal(body.paymentRecord.transaction.response_code, "SUCCESSFUL");
    assert.equal(body.statusSignal, "SUC");
  } finally {
    await server.close();
  }
});

test("POST /user-payments/verify-status marks a transaction failed when ICICI returns a verified failure", async () => {
  const paymentRecord = {
    id: "payment-3",
    status: "pending",
    paymentRequestId: "request-3",
    student: {
      userId: "user-1",
    },
    transaction: {
      transaction_id: "merchant-txn-3",
      response_code: "PENDING",
    },
    gateway: {
      tranCtx: "ctx-3",
    },
  };

  const updateCalls = [];
  const paymentRequestStatusUpdates = [];

  const handler = createVerifyUserPaymentStatusHandler({
    findUserById: async (userId) => ({
      id: userId,
      role: "user",
    }),
    findPaymentProcessedById: async (paymentRecordId) =>
      paymentRecordId === paymentRecord.id ? paymentRecord : null,
    listPaymentProcessedByUserId: async () => [],
    checkIciciSaleStatus: async () => ({
      hashVerified: true,
      status: "failed",
      dbStatusLabel: "FAILURE",
      statusSignal: "REJ",
      requestPacket: { transactionType: "STATUS" },
      responsePacket: { txnRespDescription: "Transaction Failed" },
      txnRespDescription: "Transaction Failed",
    }),
    updatePaymentProcessedById: async (paymentRecordId, patch) => {
      updateCalls.push({ paymentRecordId, patch });
      return mergePaymentRecord(paymentRecord, patch);
    },
    updatePaymentRequestStatusById: async (...args) => {
      paymentRequestStatusUpdates.push(args);
      return {
        id: paymentRecord.paymentRequestId,
        status: args[1],
      };
    },
  });

  const server = await startTestServer(handler);

  try {
    const response = await fetch(`${server.url}/user-payments/verify-status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildAuthHeader(),
      },
      body: JSON.stringify({
        paymentRecordId: paymentRecord.id,
      }),
    });

    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.status, "failed");
    assert.equal(updateCalls.length, 1);
    assert.deepEqual(paymentRequestStatusUpdates, [[paymentRecord.paymentRequestId, "failed"]]);
    assert.equal(updateCalls[0].patch.status, "failed");
    assert.equal(updateCalls[0].patch.pendingHashVerificationRetry, false);
    assert.equal(updateCalls[0].patch.transaction.status, "FAILURE");
    assert.equal(body.paymentRecord.status, "failed");
    assert.equal(body.paymentRecord.transaction.response_code, "FAILURE");
    assert.equal(body.statusSignal, "REJ");
  } finally {
    await server.close();
  }
});

test("POST /user-payments/verify-status rejects verification for another user's payment record", async () => {
  const paymentRecord = {
    id: "payment-4",
    status: "pending",
    paymentRequestId: "request-4",
    student: {
      userId: "user-2",
    },
    transaction: {
      transaction_id: "merchant-txn-4",
      response_code: "PENDING",
    },
    gateway: {
      tranCtx: "ctx-4",
    },
  };

  let iciciCallCount = 0;

  const handler = createVerifyUserPaymentStatusHandler({
    findUserById: async (userId) => ({
      id: userId,
      role: "user",
    }),
    findPaymentProcessedById: async (paymentRecordId) =>
      paymentRecordId === paymentRecord.id ? paymentRecord : null,
    listPaymentProcessedByUserId: async () => [],
    checkIciciSaleStatus: async () => {
      iciciCallCount += 1;
      return {
        hashVerified: true,
        status: "success",
      };
    },
  });

  const server = await startTestServer(handler);

  try {
    const response = await fetch(`${server.url}/user-payments/verify-status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildAuthHeader(),
      },
      body: JSON.stringify({
        paymentRecordId: paymentRecord.id,
      }),
    });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      message: "You are not allowed to verify this payment",
    });
    assert.equal(iciciCallCount, 0);
  } finally {
    await server.close();
  }
});

test("POST /user-payments/verify-status skips ICICI when the payment is already successful", async () => {
  const paymentRecord = {
    id: "payment-5",
    status: "success",
    paymentRequestId: "request-5",
    student: {
      userId: "user-1",
    },
    transaction: {
      transaction_id: "merchant-txn-5",
      response_code: "SUCCESSFUL",
    },
    gateway: {
      tranCtx: "ctx-5",
    },
  };

  let iciciCallCount = 0;
  let updateCallCount = 0;

  const handler = createVerifyUserPaymentStatusHandler({
    findUserById: async (userId) => ({
      id: userId,
      role: "user",
    }),
    findPaymentProcessedById: async (paymentRecordId) =>
      paymentRecordId === paymentRecord.id ? paymentRecord : null,
    listPaymentProcessedByUserId: async () => [],
    checkIciciSaleStatus: async () => {
      iciciCallCount += 1;
      return {
        hashVerified: true,
        status: "success",
      };
    },
    updatePaymentProcessedById: async () => {
      updateCallCount += 1;
      return paymentRecord;
    },
  });

  const server = await startTestServer(handler);

  try {
    const response = await fetch(`${server.url}/user-payments/verify-status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildAuthHeader(),
      },
      body: JSON.stringify({
        paymentRecordId: paymentRecord.id,
      }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "success",
      paymentRecord,
      message: "Payment is already marked as success",
    });
    assert.equal(iciciCallCount, 0);
    assert.equal(updateCallCount, 0);
  } finally {
    await server.close();
  }
});
