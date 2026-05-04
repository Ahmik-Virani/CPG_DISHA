import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import express from "express";
import jwt from "jsonwebtoken";

import { JWT_SECRET } from "../config.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { createCreatePaymentRequestHandler } from "../routes/create-payment-request.js";

function buildAuthHeader(overrides = {}) {
  const token = jwt.sign(
    {
      sub: "system-head-1",
      role: "system_head",
      ...overrides,
    },
    JWT_SECRET
  );

  return `Bearer ${token}`;
}

async function startTestServer(handler) {
  const app = express();
  app.use(express.json());
  app.post("/events/:eventId/payment-requests", requireAuth, requireRole("system_head"), handler);

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

function buildBankList() {
  return [
    {
      id: "bank-icici",
      displayName: "ICICI",
      normalizedDisplayName: "icici",
      enabled: true,
    },
    {
      id: "bank-sbi",
      displayName: "SBI",
      normalizedDisplayName: "sbi",
      enabled: false,
    },
  ];
}

test("POST /events/:eventId/payment-requests rejects duplicate roll numbers for one-time requests", async () => {
  let createCalls = 0;

  const handler = createCreatePaymentRequestHandler({
    findEventByIdForSystemHead: async () => ({ id: "event-1" }),
    findLatestPaymentRequestByEventAndSystemHead: async () => null,
    listBanks: async () => buildBankList(),
    createOneTimePaymentRequestRecords: async () => {
      createCalls += 1;
    },
  });

  const server = await startTestServer(handler);

  try {
    const response = await fetch(`${server.url}/events/event-1/payment-requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildAuthHeader(),
      },
      body: JSON.stringify({
        type: "one_time",
        banks: ["ICICI"],
        timeToLive: "2026-12-31T00:00:00.000Z",
        entries: [
          { rollNo: " cs23b001 ", amount: 100 },
          { rollNo: "CS23B001", amount: 200 },
        ],
      }),
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      message: "Duplicate roll numbers are not allowed in one_time requests",
    });
    assert.equal(createCalls, 0);
  } finally {
    await server.close();
  }
});

test("POST /events/:eventId/payment-requests rejects one-time requests with no valid entries or invalid TTL", async () => {
  let createCalls = 0;

  const handler = createCreatePaymentRequestHandler({
    findEventByIdForSystemHead: async () => ({ id: "event-1" }),
    findLatestPaymentRequestByEventAndSystemHead: async () => null,
    listBanks: async () => buildBankList(),
    createOneTimePaymentRequestRecords: async () => {
      createCalls += 1;
    },
  });

  const server = await startTestServer(handler);

  try {
    const response = await fetch(`${server.url}/events/event-1/payment-requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildAuthHeader(),
      },
      body: JSON.stringify({
        type: "one_time",
        banks: ["ICICI"],
        timeToLive: "not-a-date",
        entries: [
          { rollNo: "CS23B001", amount: 0 },
        ],
      }),
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      message: "At least one valid rollNo and amount pair with timeToLive is required for one_time requests",
    });
    assert.equal(createCalls, 0);
  } finally {
    await server.close();
  }
});

test("POST /events/:eventId/payment-requests rejects creation when a payment request already exists for the event", async () => {
  const existingRequest = {
    id: "request-existing",
    eventId: "event-1",
    type: "fixed",
  };

  const handler = createCreatePaymentRequestHandler({
    findEventByIdForSystemHead: async () => ({ id: "event-1" }),
    findLatestPaymentRequestByEventAndSystemHead: async () => existingRequest,
    listBanks: async () => buildBankList(),
  });

  const server = await startTestServer(handler);

  try {
    const response = await fetch(`${server.url}/events/event-1/payment-requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildAuthHeader(),
      },
      body: JSON.stringify({
        type: "fixed",
        banks: ["ICICI"],
        isAmountFixed: true,
        amount: 500,
      }),
    });

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      message: "Payment request already exists for this event",
      paymentRequest: existingRequest,
    });
  } finally {
    await server.close();
  }
});

test("POST /events/:eventId/payment-requests rejects fixed requests with invalid amount rules", async () => {
  let createCalls = 0;

  const handler = createCreatePaymentRequestHandler({
    findEventByIdForSystemHead: async () => ({ id: "event-1" }),
    findLatestPaymentRequestByEventAndSystemHead: async () => null,
    listBanks: async () => buildBankList(),
    createFixedPaymentRequestRecord: async () => {
      createCalls += 1;
    },
  });

  const server = await startTestServer(handler);

  try {
    const missingBooleanResponse = await fetch(`${server.url}/events/event-1/payment-requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildAuthHeader(),
      },
      body: JSON.stringify({
        type: "fixed",
        banks: ["ICICI"],
        amount: 500,
      }),
    });

    assert.equal(missingBooleanResponse.status, 400);
    assert.deepEqual(await missingBooleanResponse.json(), {
      message: "isAmountFixed must be a boolean for fixed requests",
    });

    const badAmountResponse = await fetch(`${server.url}/events/event-1/payment-requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildAuthHeader(),
      },
      body: JSON.stringify({
        type: "fixed",
        banks: ["ICICI"],
        isAmountFixed: true,
        amount: 0,
      }),
    });

    assert.equal(badAmountResponse.status, 400);
    assert.deepEqual(await badAmountResponse.json(), {
      message: "amount must be greater than 0 when isAmountFixed is true",
    });

    assert.equal(createCalls, 0);
  } finally {
    await server.close();
  }
});

test("POST /events/:eventId/payment-requests creates a fixed payment request with enabled banks", async () => {
  const createdRecords = [];

  const handler = createCreatePaymentRequestHandler({
    findEventByIdForSystemHead: async () => ({ id: "event-1" }),
    findLatestPaymentRequestByEventAndSystemHead: async () => null,
    listBanks: async () => buildBankList(),
    createFixedPaymentRequestRecord: async (paymentRequest) => {
      createdRecords.push(paymentRequest);
    },
  });

  const server = await startTestServer(handler);

  try {
    const response = await fetch(`${server.url}/events/event-1/payment-requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildAuthHeader(),
      },
      body: JSON.stringify({
        type: "fixed",
        banks: ["ICICI", "SBI"],
        isAmountFixed: false,
      }),
    });

    assert.equal(response.status, 201);

    const body = await response.json();
    assert.equal(body.table, "Fixed_Payment_Request");
    assert.equal(createdRecords.length, 1);
    assert.equal(createdRecords[0].type, "fixed");
    assert.deepEqual(createdRecords[0].banks, ["ICICI"]);
    assert.equal(createdRecords[0].amount, null);
    assert.equal(body.paymentRequest.bank, "ICICI");
  } finally {
    await server.close();
  }
});
