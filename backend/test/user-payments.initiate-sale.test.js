import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import express from "express";
import jwt from "jsonwebtoken";

import { JWT_SECRET } from "../config.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { createInitiateUserPaymentSaleHandler } from "../routes/user-payments.js";

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

async function startTestServer(handler) {
  const app = express();
  app.use(express.json());
  app.post("/user-payments/initiate-sale", requireAuth, requireRole("user"), handler);

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

test("POST /user-payments/initiate-sale creates a pending ICICI payment for an eligible fixed request", async () => {
  const createdPaymentRecords = [];
  const iciciCalls = [];

  const handler = createInitiateUserPaymentSaleHandler({
    findUserById: async (userId) => ({
      id: userId,
      role: "user",
      name: "Test User",
      email: "user@example.com",
      roll_no: "CS23B001",
    }),
    findOneTimePaymentRequestById: async () => null,
    findFixedPaymentRequestById: async (paymentRequestId) => ({
      id: paymentRequestId,
      amount: 1500,
      isAmountFixed: true,
      banks: ["ICICI"],
    }),
    findBankByDisplayName: async () => ({
      id: "bank-1",
      displayName: "ICICI",
      enabled: true,
    }),
    createPaymentProcessedRecord: async (paymentRecord) => {
      createdPaymentRecords.push(paymentRecord);
    },
    initiateIciciSale: async (payload) => {
      iciciCalls.push(payload);
      return {
        tranCtx: "ctx-100",
        requestPacket: {
          merchantTxnNo: "merchant-txn-100",
          merchantId: "merchant-1",
        },
        responsePacket: {
          paymentLink: "https://bank.example/pay",
        },
      };
    },
  });

  const server = await startTestServer(handler);

  try {
    const response = await fetch(`${server.url}/user-payments/initiate-sale`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildAuthHeader(),
      },
      body: JSON.stringify({
        paymentRequestId: "request-100",
        returnURL: "https://app.example/return",
      }),
    });

    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.status, "pending");
    assert.ok(body.paymentRecordId);
    assert.equal(iciciCalls.length, 1);
    assert.deepEqual(iciciCalls[0], {
      amount: 1500,
      returnURL: "https://app.example/return",
      userEmail: "user@example.com",
    });
    assert.equal(createdPaymentRecords.length, 1);
    assert.equal(createdPaymentRecords[0].paymentRequestId, "request-100");
    assert.equal(createdPaymentRecords[0].transaction.amount, 1500);
    assert.equal(createdPaymentRecords[0].bank.bank_name, "ICICI");
    assert.equal(createdPaymentRecords[0].status, "pending");
  } finally {
    await server.close();
  }
});

test("POST /user-payments/initiate-sale rejects a one-time payment request assigned to another roll number", async () => {
  let iciciCallCount = 0;

  const handler = createInitiateUserPaymentSaleHandler({
    findUserById: async (userId) => ({
      id: userId,
      role: "user",
      name: "Test User",
      email: "user@example.com",
      roll_no: "CS23B001",
    }),
    findOneTimePaymentRequestById: async (paymentRequestId) => ({
      id: paymentRequestId,
      rollNo: "CS23B999",
      amount: 500,
      banks: ["ICICI"],
    }),
    findFixedPaymentRequestById: async () => null,
    initiateIciciSale: async () => {
      iciciCallCount += 1;
      return {};
    },
  });

  const server = await startTestServer(handler);

  try {
    const response = await fetch(`${server.url}/user-payments/initiate-sale`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildAuthHeader(),
      },
      body: JSON.stringify({
        paymentRequestId: "request-101",
        returnURL: "https://app.example/return",
      }),
    });

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      message: "Payment request not found",
    });
    assert.equal(iciciCallCount, 0);
  } finally {
    await server.close();
  }
});

test("POST /user-payments/initiate-sale rejects disabled banks", async () => {
  let iciciCallCount = 0;

  const handler = createInitiateUserPaymentSaleHandler({
    findUserById: async (userId) => ({
      id: userId,
      role: "user",
      name: "Test User",
      email: "user@example.com",
      roll_no: "CS23B001",
    }),
    findOneTimePaymentRequestById: async () => null,
    findFixedPaymentRequestById: async (paymentRequestId) => ({
      id: paymentRequestId,
      amount: 700,
      isAmountFixed: true,
      banks: ["ICICI"],
    }),
    findBankByDisplayName: async () => ({
      id: "bank-2",
      displayName: "ICICI",
      enabled: false,
    }),
    initiateIciciSale: async () => {
      iciciCallCount += 1;
      return {};
    },
  });

  const server = await startTestServer(handler);

  try {
    const response = await fetch(`${server.url}/user-payments/initiate-sale`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildAuthHeader(),
      },
      body: JSON.stringify({
        paymentRequestId: "request-102",
        returnURL: "https://app.example/return",
      }),
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      message: "Not available at the moment",
    });
    assert.equal(iciciCallCount, 0);
  } finally {
    await server.close();
  }
});

test("POST /user-payments/initiate-sale rejects non-ICICI banks for now", async () => {
  let iciciCallCount = 0;

  const handler = createInitiateUserPaymentSaleHandler({
    findUserById: async (userId) => ({
      id: userId,
      role: "user",
      name: "Test User",
      email: "user@example.com",
      roll_no: "CS23B001",
    }),
    findOneTimePaymentRequestById: async () => null,
    findFixedPaymentRequestById: async (paymentRequestId) => ({
      id: paymentRequestId,
      amount: 700,
      isAmountFixed: true,
      banks: ["SBI"],
    }),
    findBankByDisplayName: async () => ({
      id: "bank-3",
      displayName: "SBI",
      enabled: true,
    }),
    initiateIciciSale: async () => {
      iciciCallCount += 1;
      return {};
    },
  });

  const server = await startTestServer(handler);

  try {
    const response = await fetch(`${server.url}/user-payments/initiate-sale`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildAuthHeader(),
      },
      body: JSON.stringify({
        paymentRequestId: "request-103",
        returnURL: "https://app.example/return",
      }),
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      message: "Yet to be added",
    });
    assert.equal(iciciCallCount, 0);
  } finally {
    await server.close();
  }
});

test("POST /user-payments/initiate-sale requires a valid positive custom amount for variable requests", async () => {
  let iciciCallCount = 0;

  const handler = createInitiateUserPaymentSaleHandler({
    findUserById: async (userId) => ({
      id: userId,
      role: "user",
      name: "Test User",
      email: "user@example.com",
      roll_no: "CS23B001",
    }),
    findOneTimePaymentRequestById: async () => null,
    findFixedPaymentRequestById: async (paymentRequestId) => ({
      id: paymentRequestId,
      amount: null,
      isAmountFixed: false,
      banks: ["ICICI"],
    }),
    findBankByDisplayName: async () => ({
      id: "bank-4",
      displayName: "ICICI",
      enabled: true,
    }),
    initiateIciciSale: async () => {
      iciciCallCount += 1;
      return {};
    },
  });

  const server = await startTestServer(handler);

  try {
    const missingAmountResponse = await fetch(`${server.url}/user-payments/initiate-sale`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildAuthHeader(),
      },
      body: JSON.stringify({
        paymentRequestId: "request-104",
        returnURL: "https://app.example/return",
      }),
    });

    assert.equal(missingAmountResponse.status, 400);
    assert.deepEqual(await missingAmountResponse.json(), {
      message: "Amount is required for variable payment requests",
    });

    const invalidAmountResponse = await fetch(`${server.url}/user-payments/initiate-sale`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildAuthHeader(),
      },
      body: JSON.stringify({
        paymentRequestId: "request-104",
        returnURL: "https://app.example/return",
        customAmount: 0,
      }),
    });

    assert.equal(invalidAmountResponse.status, 400);
    assert.deepEqual(await invalidAmountResponse.json(), {
      message: "Please provide a valid positive amount",
    });

    assert.equal(iciciCallCount, 0);
  } finally {
    await server.close();
  }
});
