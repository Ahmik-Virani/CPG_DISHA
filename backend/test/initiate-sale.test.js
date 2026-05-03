import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { signToken } from "../utils.js";
import { normalizeRollNo } from "../utils.js";

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

// ─── mini app builder ────────────────────────────────────────────────────────
//
// Replicates the exact logic of POST /initiate-sale from user-payments.js.
// DB calls and ICICI call are replaced with inline fakes controlled by config.
//
// Config shape:
//   fakeUser          - what findUserById returns (null = user not found)
//   fakePaymentRequest- what the payment request lookup returns (null = not found)
//                       set rollNo on it to test one-time roll number scoping
//   fakeBankDoc       - what findBankByDisplayName returns
//   iciciShouldFail   - if true, initiateIciciSale throws an error

function getEnabledBanks(request) {
  const fromArray = Array.isArray(request?.banks)
    ? request.banks.map((b) => String(b || "").trim()).filter(Boolean)
    : [];
  const fallback = String(request?.bank || "").trim();
  return [...new Set(fromArray.length ? fromArray : fallback ? [fallback] : [])];
}

function buildApp({ fakeUser, fakePaymentRequest, fakeBankDoc, iciciShouldFail = false }) {
  const app = express();
  app.use(express.json());

  app.post("/initiate-sale", requireAuth, requireRole("user"), async (req, res) => {
    const paymentRequestId = String(req.body?.paymentRequestId || "").trim();
    const returnURL = String(req.body?.returnURL || "").trim();
    const selectedBankInput = String(req.body?.bank || "").trim();
    const customAmount = req.body?.customAmount;

    // Step 1: validate required fields
    if (!paymentRequestId) {
      return res.status(400).json({ message: "paymentRequestId is required" });
    }
    if (!returnURL) {
      return res.status(400).json({ message: "returnURL is required" });
    }

    // Step 2: find user (fake DB)
    const user = fakeUser;
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Step 3: resolve payment request for this user (fake DB)
    // Mirrors resolvePayableRequestForUser — one-time requests check roll number
    let paymentRequest = null;
    if (fakePaymentRequest) {
      if (fakePaymentRequest.type === "one_time") {
        const userRollNo = normalizeRollNo(user.roll_no);
        if (userRollNo && normalizeRollNo(fakePaymentRequest.rollNo) === userRollNo) {
          paymentRequest = fakePaymentRequest;
        }
      } else {
        paymentRequest = fakePaymentRequest;
      }
    }

    if (!paymentRequest) {
      return res.status(404).json({ message: "Payment request not found" });
    }

    // Step 4: validate enabled banks
    const enabledBanks = getEnabledBanks(paymentRequest);
    if (!enabledBanks.length) {
      return res.status(400).json({ message: "No banks are enabled for this payment request" });
    }

    const selectedBank = selectedBankInput || enabledBanks[0];
    const selectedBankMatch = enabledBanks.find(
      (b) => b.toLowerCase() === selectedBank.toLowerCase()
    );
    if (!selectedBankMatch) {
      return res.status(400).json({ message: "Selected bank is not enabled for this payment request" });
    }

    // Step 5: check bank enabled in DB (fake)
    const bankDoc = fakeBankDoc;
    const isEnabled = typeof bankDoc?.enabled === "boolean" ? bankDoc.enabled : true;
    if (!isEnabled) {
      return res.status(400).json({ message: "Not available at the moment" });
    }

    // Step 6: only ICICI supported
    if (selectedBankMatch.toLowerCase() !== "icici") {
      return res.status(400).json({ message: "Yet to be added" });
    }

    // Step 7: variable amount validation
    let finalAmount = paymentRequest.amount;
    const isVariableAmount = paymentRequest?.isAmountFixed === false;
    if (isVariableAmount) {
      if (customAmount === undefined || customAmount === null) {
        return res.status(400).json({ message: "Amount is required for variable payment requests" });
      }
      const parsedAmount = Number(customAmount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ message: "Please provide a valid positive amount" });
      }
      finalAmount = parsedAmount;
    }

    // Step 8: ICICI call (stubbed)
    if (iciciShouldFail) {
      return res.status(502).json({ message: "Failed to initiate ICICI payment" });
    }

    const paymentRecordId = crypto.randomUUID();
    return res.json({
      paymentRecordId,
      returnURL,
      status: "pending",
      paymentURL: "https://fake-icici-redirect.example.com",
      amount: finalAmount,
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
  role: "user",
};

const validFixedRequest = {
  id: "req-fixed-1",
  type: "fixed",
  banks: ["ICICI"],
  isAmountFixed: true,
  amount: 500,
};

const validVariableRequest = {
  id: "req-variable-1",
  type: "fixed",
  banks: ["ICICI"],
  isAmountFixed: false,
  amount: null,
};

const validOneTimeRequest = {
  id: "req-onetime-1",
  type: "one_time",
  banks: ["ICICI"],
  rollNo: "CS21BTECH11001",
  amount: 1000,
};

const oneTimeRequestWrongRoll = {
  ...validOneTimeRequest,
  rollNo: "CS21BTECH11999", // different student
};

const iciciBank = { id: "bank-icici", displayName: "ICICI", enabled: true };
const disabledBank = { id: "bank-icici", displayName: "ICICI", enabled: false };

const userToken = signToken({ id: "user-1", role: "user", email: "student@iith.ac.in" });

// ─── tests ───────────────────────────────────────────────────────────────────

// 1. Missing paymentRequestId → 400
await runCase("rejects initiation when paymentRequestId is missing", async () => {
  const { server, baseUrl } = makeServer(buildApp({ fakeUser: validUser, fakePaymentRequest: validFixedRequest, fakeBankDoc: iciciBank }));
  try {
    const { response, body } = await post(baseUrl, "/initiate-sale", {
      token: userToken,
      body: { returnURL: "https://app.example.com/return" },
    });
    assert.equal(response.status, 400);
    assert.equal(body.message, "paymentRequestId is required");
  } finally {
    await closeServer(server);
  }
});

// 2. Missing returnURL → 400
await runCase("rejects initiation when returnURL is missing", async () => {
  const { server, baseUrl } = makeServer(buildApp({ fakeUser: validUser, fakePaymentRequest: validFixedRequest, fakeBankDoc: iciciBank }));
  try {
    const { response, body } = await post(baseUrl, "/initiate-sale", {
      token: userToken,
      body: { paymentRequestId: "req-fixed-1" },
    });
    assert.equal(response.status, 400);
    assert.equal(body.message, "returnURL is required");
  } finally {
    await closeServer(server);
  }
});

// 3. Payment request not found → 404
await runCase("rejects initiation when payment request does not exist", async () => {
  const { server, baseUrl } = makeServer(buildApp({ fakeUser: validUser, fakePaymentRequest: null, fakeBankDoc: iciciBank }));
  try {
    const { response, body } = await post(baseUrl, "/initiate-sale", {
      token: userToken,
      body: { paymentRequestId: "nonexistent-req", returnURL: "https://app.example.com/return" },
    });
    assert.equal(response.status, 404);
    assert.equal(body.message, "Payment request not found");
  } finally {
    await closeServer(server);
  }
});

// 4. One-time request not assigned to this user's roll number → 404
await runCase("rejects initiation when one-time request is not assigned to user's roll number", async () => {
  const { server, baseUrl } = makeServer(buildApp({ fakeUser: validUser, fakePaymentRequest: oneTimeRequestWrongRoll, fakeBankDoc: iciciBank }));
  try {
    const { response, body } = await post(baseUrl, "/initiate-sale", {
      token: userToken,
      body: { paymentRequestId: "req-onetime-1", returnURL: "https://app.example.com/return" },
    });
    assert.equal(response.status, 404);
    assert.equal(body.message, "Payment request not found");
  } finally {
    await closeServer(server);
  }
});

// 5. No banks enabled on payment request → 400
await runCase("rejects initiation when no banks are enabled on the payment request", async () => {
  const noBanksRequest = { ...validFixedRequest, banks: [], bank: "" };
  const { server, baseUrl } = makeServer(buildApp({ fakeUser: validUser, fakePaymentRequest: noBanksRequest, fakeBankDoc: iciciBank }));
  try {
    const { response, body } = await post(baseUrl, "/initiate-sale", {
      token: userToken,
      body: { paymentRequestId: "req-fixed-1", returnURL: "https://app.example.com/return" },
    });
    assert.equal(response.status, 400);
    assert.equal(body.message, "No banks are enabled for this payment request");
  } finally {
    await closeServer(server);
  }
});

// 6. Selected bank not in the payment request's enabled banks → 400
await runCase("rejects initiation when selected bank is not enabled for this request", async () => {
  const { server, baseUrl } = makeServer(buildApp({ fakeUser: validUser, fakePaymentRequest: validFixedRequest, fakeBankDoc: iciciBank }));
  try {
    const { response, body } = await post(baseUrl, "/initiate-sale", {
      token: userToken,
      body: { paymentRequestId: "req-fixed-1", returnURL: "https://app.example.com/return", bank: "HDFC" },
    });
    assert.equal(response.status, 400);
    assert.equal(body.message, "Selected bank is not enabled for this payment request");
  } finally {
    await closeServer(server);
  }
});

// 7. Bank is marked disabled in the DB → 400
await runCase("rejects initiation when bank is disabled in the system", async () => {
  const { server, baseUrl } = makeServer(buildApp({ fakeUser: validUser, fakePaymentRequest: validFixedRequest, fakeBankDoc: disabledBank }));
  try {
    const { response, body } = await post(baseUrl, "/initiate-sale", {
      token: userToken,
      body: { paymentRequestId: "req-fixed-1", returnURL: "https://app.example.com/return" },
    });
    assert.equal(response.status, 400);
    assert.equal(body.message, "Not available at the moment");
  } finally {
    await closeServer(server);
  }
});

// 8. Non-ICICI bank selected → 400
await runCase("rejects initiation for non-ICICI bank as it is not yet implemented", async () => {
  const sbiRequest = { ...validFixedRequest, banks: ["SBI"] };
  const sbiBank = { id: "bank-sbi", displayName: "SBI", enabled: true };
  const { server, baseUrl } = makeServer(buildApp({ fakeUser: validUser, fakePaymentRequest: sbiRequest, fakeBankDoc: sbiBank }));
  try {
    const { response, body } = await post(baseUrl, "/initiate-sale", {
      token: userToken,
      body: { paymentRequestId: "req-fixed-1", returnURL: "https://app.example.com/return", bank: "SBI" },
    });
    assert.equal(response.status, 400);
    assert.equal(body.message, "Yet to be added");
  } finally {
    await closeServer(server);
  }
});

// 9. Variable amount request with no customAmount provided → 400
await runCase("rejects initiation for variable amount request when customAmount is missing", async () => {
  const { server, baseUrl } = makeServer(buildApp({ fakeUser: validUser, fakePaymentRequest: validVariableRequest, fakeBankDoc: iciciBank }));
  try {
    const { response, body } = await post(baseUrl, "/initiate-sale", {
      token: userToken,
      body: { paymentRequestId: "req-variable-1", returnURL: "https://app.example.com/return" },
    });
    assert.equal(response.status, 400);
    assert.equal(body.message, "Amount is required for variable payment requests");
  } finally {
    await closeServer(server);
  }
});

// 10. Variable amount request with invalid amount (negative) → 400
await runCase("rejects initiation for variable amount request when customAmount is negative", async () => {
  const { server, baseUrl } = makeServer(buildApp({ fakeUser: validUser, fakePaymentRequest: validVariableRequest, fakeBankDoc: iciciBank }));
  try {
    const { response, body } = await post(baseUrl, "/initiate-sale", {
      token: userToken,
      body: { paymentRequestId: "req-variable-1", returnURL: "https://app.example.com/return", customAmount: -100 },
    });
    assert.equal(response.status, 400);
    assert.equal(body.message, "Please provide a valid positive amount");
  } finally {
    await closeServer(server);
  }
});

// 11. Valid fixed request → 200, pending payment record created
await runCase("allows eligible user to initiate payment for a valid fixed request", async () => {
  const { server, baseUrl } = makeServer(buildApp({ fakeUser: validUser, fakePaymentRequest: validFixedRequest, fakeBankDoc: iciciBank }));
  try {
    const { response, body } = await post(baseUrl, "/initiate-sale", {
      token: userToken,
      body: { paymentRequestId: "req-fixed-1", returnURL: "https://app.example.com/return" },
    });
    assert.equal(response.status, 200);
    assert.equal(body.status, "pending");
    assert.ok(body.paymentRecordId, "paymentRecordId should be present");
    assert.ok(body.paymentURL, "paymentURL should be present");
    assert.equal(body.amount, 500);
  } finally {
    await closeServer(server);
  }
});

// 12. Valid one-time request assigned to correct roll number → 200
await runCase("allows eligible user to initiate payment for a one-time request assigned to their roll number", async () => {
  const { server, baseUrl } = makeServer(buildApp({ fakeUser: validUser, fakePaymentRequest: validOneTimeRequest, fakeBankDoc: iciciBank }));
  try {
    const { response, body } = await post(baseUrl, "/initiate-sale", {
      token: userToken,
      body: { paymentRequestId: "req-onetime-1", returnURL: "https://app.example.com/return" },
    });
    assert.equal(response.status, 200);
    assert.equal(body.status, "pending");
    assert.ok(body.paymentRecordId, "paymentRecordId should be present");
    assert.equal(body.amount, 1000);
  } finally {
    await closeServer(server);
  }
});

// 13. Valid variable amount request with correct customAmount → 200
await runCase("allows eligible user to initiate variable amount payment with a valid custom amount", async () => {
  const { server, baseUrl } = makeServer(buildApp({ fakeUser: validUser, fakePaymentRequest: validVariableRequest, fakeBankDoc: iciciBank }));
  try {
    const { response, body } = await post(baseUrl, "/initiate-sale", {
      token: userToken,
      body: { paymentRequestId: "req-variable-1", returnURL: "https://app.example.com/return", customAmount: 750 },
    });
    assert.equal(response.status, 200);
    assert.equal(body.status, "pending");
    assert.equal(body.amount, 750);
  } finally {
    await closeServer(server);
  }
});

if (!process.exitCode) {
  console.log("All initiate-sale tests passed.");
}
