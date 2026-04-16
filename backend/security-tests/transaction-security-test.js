import assert from "node:assert";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config({ path: new URL("../.env", import.meta.url) });

const BASE_URL = process.env.BACKEND_URL || "http://localhost:4000";
const SYSTEM_HEAD_EMAIL = process.env.SEC_TEST_SYSTEM_HEAD_EMAIL || "security-test-system-head@example.com";
const SYSTEM_HEAD_PASSWORD = process.env.SEC_TEST_SYSTEM_HEAD_PASSWORD || "Test@12345";
const USER_EMAIL = process.env.SEC_TEST_USER_EMAIL || "security-test-user@example.com";
const USER_PASSWORD = process.env.SEC_TEST_USER_PASSWORD || "Test@12345";
const USER_ROLL = process.env.SEC_TEST_USER_ROLL || "SEC-USER";
const TEST_RETURN_URL = process.env.SEC_TEST_RETURN_URL || "http://localhost:3000/payment-return";
const CLEANUP_EMAIL_REGEX = process.env.SEC_TEST_CLEANUP_EMAIL_REGEX || "^(security-test|load-test)";
const MONGODB_URI = process.env.MONGODB_CONNECTION_STRING || process.env.MONGODB_URL || process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || process.env.MONGODB_DB || "CPG_DISHA";

const jsonHeaders = {
  "Content-Type": "application/json",
};

function fetchRequest(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  return fetch(url, options);
}

async function parseJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text };
  }
}

async function request(path, options = {}) {
  const response = await fetchRequest(path, options);
  const body = await parseJson(response);
  return { response, body };
}

async function cleanupTestData() {
  if (!MONGODB_URI) {
    console.warn("Skipping DB cleanup because no MongoDB connection string is configured.");
    return;
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  try {
    const db = client.db(MONGODB_DB_NAME);
    const usersCollection = db.collection("users");
    const eventsCollection = db.collection("Events");
    const fixedCollection = db.collection("Fixed_Payment_Request");
    const oneTimeCollection = db.collection("One_Time_Payment_Request");
    const recurringCollection = db.collection("Recurring_Payment_Request");
    const paymentsCollection = db.collection("Payment_Processed");

    const emailRegex = new RegExp(CLEANUP_EMAIL_REGEX, "i");
    const testUsers = await usersCollection.find({ email: { $regex: emailRegex } }).project({ id: 1 }).toArray();
    const testUserIds = testUsers.map((user) => user.id).filter(Boolean);

    const eventNameRegex = new RegExp("^(Security Test|Load Test)", "i");
    const eventQuery = {
      $or: [
        { createdBySystemHeadId: { $in: testUserIds } },
        { name: { $regex: eventNameRegex } },
      ],
    };
    const testEvents = await eventsCollection.find(eventQuery).project({ id: 1 }).toArray();
    const testEventIds = testEvents.map((event) => event.id).filter(Boolean);

    const eventsDeleteResult = await eventsCollection.deleteMany(eventQuery);
    console.log(`Cleanup: deleted ${eventsDeleteResult.deletedCount} test events`);

    const paymentRequestQuery = {
      $or: [
        { createdBySystemHeadId: { $in: testUserIds } },
        { eventId: { $in: testEventIds } },
      ],
    };

    const fixedDeleteResult = await fixedCollection.deleteMany(paymentRequestQuery);
    const oneTimeDeleteResult = await oneTimeCollection.deleteMany(paymentRequestQuery);
    const recurringDeleteResult = await recurringCollection.deleteMany(paymentRequestQuery);

    console.log(`Cleanup: deleted ${fixedDeleteResult.deletedCount} fixed payment requests`);
    console.log(`Cleanup: deleted ${oneTimeDeleteResult.deletedCount} one-time payment requests`);
    console.log(`Cleanup: deleted ${recurringDeleteResult.deletedCount} recurring payment requests`);

    const userDeleteResult = await usersCollection.deleteMany({
      email: { $regex: emailRegex },
    });
    console.log(`Cleanup: deleted ${userDeleteResult.deletedCount} test users`);

    const paymentsDeleteResult = await paymentsCollection.deleteMany({
      "student.email": { $regex: emailRegex },
    });
    console.log(`Cleanup: deleted ${paymentsDeleteResult.deletedCount} test payment records`);
  } catch (error) {
    console.error("Cleanup failed:", error.message || error);
  } finally {
    await client.close();
  }
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    ...jsonHeaders,
  };
}

function assertStatus(response, expected, message) {
  assert.strictEqual(response.status, expected, `${message} (got ${response.status})`);
}

async function loginUser(email, password) {
  const { response, body } = await request("/auth/login", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ email, password }),
  });

  assertStatus(response, 200, "Login should succeed with valid credentials");
  assert.ok(body.token, "Login response must include a token");
  return body.token;
}

async function signupOrLoginUser(role, email, password, roll_no) {
  const body = {
    name: `Security Test ${role}`,
    email,
    password,
    role,
    ...(role === "user" ? { roll_no } : {}),
  };

  const { response, body: responseBody } = await request("/auth/signup", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });

  if (response.status === 201) {
    assert.ok(responseBody.token, "Signup response must include a token");
    return responseBody.token;
  }

  if (response.status === 409) {
    return loginUser(email, password);
  }

  throw new Error(`Signup failed for ${role}: ${response.status} ${JSON.stringify(responseBody)}`);
}

async function getMe(token) {
  const { response, body } = await request("/auth/me", {
    method: "GET",
    headers: authHeaders(token),
  });

  assertStatus(response, 200, "/auth/me should return 200");
  assert.ok(body.user, "Authenticated /auth/me should include user");
  return body.user;
}

async function getHealth() {
  const { response } = await request("/health", {
    method: "GET",
    headers: jsonHeaders,
  });

  assertStatus(response, 200, "/health should return 200");
}

async function getBankOptions(token) {
  const { response, body } = await request("/events/banks/options", {
    method: "GET",
    headers: authHeaders(token),
  });

  assertStatus(response, 200, "System head should fetch bank options");
  assert.ok(Array.isArray(body.banks), "Bank options response must include banks array");
  return body.banks;
}

async function createEvent(token, name) {
  const eventName = name || `Security Test Event ${randomUUID().slice(0, 6)}`;
  const { response, body } = await request("/events", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ name: eventName, description: "Security test event" }),
  });

  assertStatus(response, 201, "System head should create an event");
  assert.ok(body.event?.id, "Created event should include id");
  return body.event.id;
}

async function createOneTimePaymentRequest(token, eventId, bankName, rollNo, amount) {
  const { response, body } = await request(`/events/${eventId}/payment-requests`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      type: "one_time",
      bank: bankName,
      entries: [{ rollNo, amount }],
      timeToLive: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }),
  });

  assertStatus(response, 201, "System head should create one_time payment request");
  assert.ok(Array.isArray(body.paymentRequests), "Payment request response should include paymentRequests array");
  return body.paymentRequests[0].id;
}

async function createFixedPaymentRequest(token, eventId, bankName, amount) {
  const { response, body } = await request(`/events/${eventId}/payment-requests`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      type: "fixed",
      bank: bankName,
      isAmountFixed: true,
      amount,
    }),
  });

  assertStatus(response, 201, "System head should create fixed payment request");
  assert.strictEqual(body.paymentRequest.type, "fixed", "Fixed payment request type should be fixed");
  return body.paymentRequest.id;
}

async function createRecurringPaymentRequest(token, eventId, bankName) {
  const { response, body } = await request(`/events/${eventId}/payment-requests`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      type: "recurring",
      bank: bankName,
      isAmountFixed: true,
      amount: 120,
      recurringMode: "interval",
      intervalValue: 1,
      intervalUnit: "months",
    }),
  });

  assertStatus(response, 201, "System head should create recurring payment request");
  assert.strictEqual(body.paymentRequest.type, "recurring");
  return body.paymentRequest.id;
}

async function getPendingUserPayments(token) {
  const { response, body } = await request("/user-payments/pending", {
    method: "GET",
    headers: authHeaders(token),
  });

  assertStatus(response, 200, "User should fetch pending payments");
  assert.ok(Array.isArray(body.requests), "Pending payments response should include requests array");
  return body.requests;
}

async function getOptionalUserPayments(token) {
  const { response, body } = await request("/user-payments/optional", {
    method: "GET",
    headers: authHeaders(token),
  });

  assertStatus(response, 200, "User should fetch optional payments");
  assert.ok(Array.isArray(body.requests), "Optional payments response should include requests array");
  return body.requests;
}

async function getLatestPaymentRequest(eventId, token) {
  const { response, body } = await request(`/events/${eventId}/payment-requests/latest`, {
    method: "GET",
    headers: authHeaders(token),
  });

  assertStatus(response, 200, "System head should fetch latest payment request");
  return body.paymentRequest;
}

async function getEventById(eventId, token) {
  const { response, body } = await request(`/events/${eventId}`, {
    method: "GET",
    headers: authHeaders(token),
  });

  assertStatus(response, 200, "System head should fetch event by id");
  return body.event;
}

async function getSystemHeadTransactionHistory(eventId, token) {
  const { response, body } = await request(`/events/transactions/history?eventId=${eventId}`, {
    method: "GET",
    headers: authHeaders(token),
  });

  assertStatus(response, 200, "System head transaction history should return 200");
  assert.ok(Array.isArray(body.transactions), "Transaction history should include transactions array");
  return body.transactions;
}

async function deleteOneTimePaymentRequest(token, paymentRequestId) {
  const { response, body } = await request(`/events/one-time-payment-requests/${paymentRequestId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });

  return { response, body };
}

async function initiateSale(token, paymentRequestId, bank, returnURL, customAmount) {
  const payload = { paymentRequestId, bank, returnURL };
  if (customAmount !== undefined) {
    payload.customAmount = customAmount;
  }

  return await request("/user-payments/initiate-sale", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

async function verifyPaymentStatus(token, paymentRecordId, paymentRequestId) {
  const payload = paymentRecordId ? { paymentRecordId } : { paymentRequestId };
  return await request("/user-payments/verify-status", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

function formatError(error) {
  if (!error) return "Unknown error";
  return error.message || String(error);
}

async function run() {
  if (!globalThis.fetch) {
    throw new Error("This script requires Node.js 18+ or a compatible fetch implementation.");
  }

  console.log(`Running security tests against ${BASE_URL}`);
  const failures = [];
  let totalTests = 0;

  const runTest = async (name, testFn) => {
    totalTests += 1;
    try {
      await testFn();
      console.log(`✅ ${name}`);
    } catch (error) {
      failures.push({ name, error: formatError(error) });
      console.error(`❌ ${name}: ${formatError(error)}`);
    }
  };

  let userToken;
  let systemHeadToken;
  let bankName;
  let eventOneTime;
  let eventFixed;
  let eventRecurring;
  let oneTimeRequestId;
  let paymentRecordId;

  await runTest("create/login user", async () => {
    userToken = await signupOrLoginUser("user", USER_EMAIL, USER_PASSWORD, USER_ROLL);
    assert.ok(userToken, "User token must be present");
  });

  await runTest("create/login system head", async () => {
    systemHeadToken = await signupOrLoginUser("system_head", SYSTEM_HEAD_EMAIL, SYSTEM_HEAD_PASSWORD);
    assert.ok(systemHeadToken, "System head token must be present");
  });

  await runTest("verify system head profile", async () => {
    assert.ok(systemHeadToken, "System head token is required");
    const systemHeadMe = await getMe(systemHeadToken);
    assert.strictEqual(systemHeadMe.role, "system_head", "Signed in system head should have system_head role");
  });

  await runTest("verify user profile", async () => {
    assert.ok(userToken, "User token is required");
    const userMe = await getMe(userToken);
    assert.strictEqual(userMe.role, "user", "Signed in user should have user role");
    assert.strictEqual(String(userMe.roll_no).toUpperCase(), String(USER_ROLL).toUpperCase(), "User roll number should match");
  });

  await runTest("health endpoint is reachable", async () => {
    await getHealth();
  });

  await runTest("invalid login is rejected", async () => {
    const invalidLogin = await request("/auth/login", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ email: USER_EMAIL, password: "WrongPassword!" }),
    });
    assertStatus(invalidLogin.response, 401, "Invalid login should return 401");
  });

  await runTest("missing token is rejected", async () => {
    const missingAuthResult = await request("/events", { method: "GET" });
    assertStatus(missingAuthResult.response, 401, "Missing token should return 401");
  });

  await runTest("invalid token is rejected", async () => {
    const invalidTokenResult = await request("/events", {
      method: "GET",
      headers: authHeaders("invalid-token"),
    });
    assertStatus(invalidTokenResult.response, 401, "Invalid token should return 401");
  });

  await runTest("user role is forbidden from system head route", async () => {
    assert.ok(userToken, "User token is required");
    const userForbidden = await request("/events", {
      method: "GET",
      headers: authHeaders(userToken),
    });
    assertStatus(userForbidden.response, 403, "User should not access system_head event route");
  });

  await runTest("fetch bank options", async () => {
    assert.ok(systemHeadToken, "System head token is required");
    const banks = await getBankOptions(systemHeadToken);
    bankName = banks[0]?.name;
    assert.ok(bankName, "At least one enabled bank must exist for the tests");
  });

  await runTest("create test events", async () => {
    assert.ok(systemHeadToken, "System head token is required");
    eventOneTime = await createEvent(systemHeadToken, `OneTime Event ${randomUUID().slice(0, 6)}`);
    eventFixed = await createEvent(systemHeadToken, `Fixed Event ${randomUUID().slice(0, 6)}`);
    eventRecurring = await createEvent(systemHeadToken, `Recurring Event ${randomUUID().slice(0, 6)}`);
  });

  await runTest("reject unsupported payment request type", async () => {
    assert.ok(systemHeadToken && eventOneTime && bankName, "System head token, event and bank are required");
    const invalidTypeResponse = await request(`/events/${eventOneTime}/payment-requests`, {
      method: "POST",
      headers: authHeaders(systemHeadToken),
      body: JSON.stringify({
        type: "bad-type",
        bank: bankName,
        entries: [{ rollNo: USER_ROLL, amount: 100 }],
        timeToLive: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }),
    });
    assertStatus(invalidTypeResponse.response, 400, "Unsupported payment request type should return 400");
  });

  await runTest("reject invalid one-time payment request", async () => {
    assert.ok(systemHeadToken && eventOneTime && bankName, "System head token, event and bank are required");
    const invalidOneTimeResponse = await request(`/events/${eventOneTime}/payment-requests`, {
      method: "POST",
      headers: authHeaders(systemHeadToken),
      body: JSON.stringify({
        type: "one_time",
        bank: bankName,
        entries: [{ rollNo: "", amount: -5 }],
        timeToLive: "bad-date",
      }),
    });
    assertStatus(invalidOneTimeResponse.response, 400, "Invalid one_time payment request should return 400");
  });

  await runTest("create one-time payment request", async () => {
    assert.ok(systemHeadToken && eventOneTime && bankName, "System head token, event and bank are required");
    oneTimeRequestId = await createOneTimePaymentRequest(systemHeadToken, eventOneTime, bankName, USER_ROLL, 150);
    assert.ok(oneTimeRequestId, "One-time request id should be present");
  });

  await runTest("pending payments include one-time request", async () => {
    assert.ok(userToken, "User token is required");
    const pendingListBefore = await getPendingUserPayments(userToken);
    assert.ok(pendingListBefore.some((item) => String(item.rollNo).toUpperCase() === String(USER_ROLL).toUpperCase()), "Pending payments should include the user's one-time request");
  });

  await runTest("create fixed payment request", async () => {
    assert.ok(systemHeadToken && eventFixed && bankName, "System head token, fixed event and bank are required");
    const fixedRequestId = await createFixedPaymentRequest(systemHeadToken, eventFixed, bankName, 200);
    assert.ok(fixedRequestId, "Fixed request id should be present");
  });

  await runTest("create recurring payment request", async () => {
    assert.ok(systemHeadToken && eventRecurring && bankName, "System head token, recurring event and bank are required");
    const recurringRequestId = await createRecurringPaymentRequest(systemHeadToken, eventRecurring, bankName);
    assert.ok(recurringRequestId, "Recurring request id should be present");
  });

  await runTest("verify-status rejects missing payment ids", async () => {
    assert.ok(userToken, "User token is required");
    const verifyBadRequest = await verifyPaymentStatus(userToken, null, null);
    assertStatus(verifyBadRequest.response, 400, "Missing payment ids should return 400");
  });

  await runTest("verify-status rejects missing payment record", async () => {
    assert.ok(userToken, "User token is required");
    const verifyMissingRecord = await verifyPaymentStatus(userToken, `missing-${randomUUID().slice(0, 6)}`, null);
    assertStatus(verifyMissingRecord.response, 404, "Non-existing payment record should return 404");
  });

  await runTest("system head cannot verify user payment", async () => {
    assert.ok(systemHeadToken && oneTimeRequestId, "System head token and one-time request id are required");
    const verifyWithSystemHead = await verifyPaymentStatus(systemHeadToken, oneTimeRequestId, null);
    assertStatus(verifyWithSystemHead.response, 403, "System head should not verify a user payment status");
  });

  await runTest("initiate sale rejects unknown bank", async () => {
    assert.ok(userToken && oneTimeRequestId, "User token and one-time request id are required");
    const initiateBadBank = await initiateSale(userToken, oneTimeRequestId, "UNKNOWN BANK", TEST_RETURN_URL);
    assertStatus(initiateBadBank.response, 400, "Initiate sale with unknown bank should return 400");
  });

  await runTest("initiate sale requires returnURL", async () => {
    assert.ok(userToken && oneTimeRequestId && bankName, "User token, one-time request id and bank are required");
    const initiateMissingReturn = await request("/user-payments/initiate-sale", {
      method: "POST",
      headers: authHeaders(userToken),
      body: JSON.stringify({ paymentRequestId: oneTimeRequestId, bank: bankName }),
    });
    assertStatus(initiateMissingReturn.response, 400, "Missing returnURL should return 400");
  });

  await runTest("initiate sale creates pending payment", async () => {
    assert.ok(userToken && oneTimeRequestId && bankName, "User token, one-time request id and bank are required");
    const initiateResponse = await initiateSale(userToken, oneTimeRequestId, bankName, TEST_RETURN_URL);
    assertStatus(initiateResponse.response, 200, "Initiate sale should return 200 when bank config is available");
    assert.strictEqual(initiateResponse.body.status, "pending", "Initiate-sale should return pending status");
    assert.ok(initiateResponse.body.paymentRecordId, "Initiate-sale should return paymentRecordId");
    paymentRecordId = initiateResponse.body.paymentRecordId;
  });

  await runTest("pending payments still include initiated payment", async () => {
    assert.ok(userToken, "User token is required");
    const pendingListAfterInitiate = await getPendingUserPayments(userToken);
    assert.ok(pendingListAfterInitiate.some((item) => String(item.rollNo).toUpperCase() === String(USER_ROLL).toUpperCase()), "Pending payments should still include the payment request after initiate-sale");
  });

  await runTest("verify-status returns valid status", async () => {
    assert.ok(userToken && paymentRecordId, "User token and payment record id are required");
    const verifyResponse = await verifyPaymentStatus(userToken, paymentRecordId, null);
    assertStatus(verifyResponse.response, 200, "verify-status should return 200 for an existing payment record");
    assert.ok(["success", "failed", "pending"].includes(String(verifyResponse.body.status).toLowerCase()), "verify-status should return a valid status");

    if (verifyResponse.body.status === "success" || verifyResponse.body.status === "failed") {
      const pendingAfterSuccess = await getPendingUserPayments(userToken);
      assert.ok(!pendingAfterSuccess.some((item) => String(item.rollNo).toUpperCase() === String(USER_ROLL).toUpperCase()), "Pending payments should no longer show successful/failed transactions");

      const historyResponse = await request("/user-payments/history", {
        method: "GET",
        headers: authHeaders(userToken),
      });
      assertStatus(historyResponse.response, 200, "User payment history should return 200");
      assert.ok(Array.isArray(historyResponse.body.transactions), "User history should include transactions array");
      assert.ok(historyResponse.body.transactions.some((txn) => String(txn.paymentRequestId || "").includes(oneTimeRequestId) || String(txn.id || "").includes(paymentRecordId)), "Transaction history should include the payment record");
    } else {
      const pendingAfterPending = await getPendingUserPayments(userToken);
      assert.ok(pendingAfterPending.some((item) => String(item.rollNo).toUpperCase() === String(USER_ROLL).toUpperCase()), "Pending payments should still include unresolved pending payments");
    }
  });

  await runTest("other user cannot verify someone else's payment", async () => {
    assert.ok(paymentRecordId, "Payment record id is required");
    const anotherUserToken = await signupOrLoginUser(
      "user",
      process.env.SEC_TEST_SECOND_USER_EMAIL || "security-test-user-2@example.com",
      USER_PASSWORD,
      process.env.SEC_TEST_SECOND_USER_ROLL || "SEC-USER-2"
    );
    const verifyOtherUser = await verifyPaymentStatus(anotherUserToken, paymentRecordId, null);
    assertStatus(verifyOtherUser.response, 403, "A different user should not verify someone else's payment");
  });

  await runTest("system head event details endpoint returns expected event", async () => {
    assert.ok(eventOneTime && systemHeadToken, "One-time event id and system head token are required");
    const eventDetails = await getEventById(eventOneTime, systemHeadToken);
    assert.strictEqual(eventDetails.id, eventOneTime, "Event details endpoint should return the correct event");
  });

  await runTest("latest payment request is one-time", async () => {
    assert.ok(eventOneTime && systemHeadToken, "One-time event id and system head token are required");
    const latestRequest = await getLatestPaymentRequest(eventOneTime, systemHeadToken);
    assert.strictEqual(latestRequest.type, "one_time", "Latest request type should be one_time");
  });

  await runTest("system head transaction history returns array", async () => {
    assert.ok(eventOneTime && systemHeadToken, "One-time event id and system head token are required");
    const transactionHistory = await getSystemHeadTransactionHistory(eventOneTime, systemHeadToken);
    assert.ok(Array.isArray(transactionHistory), "System head transaction history should return an array");
  });

  await runTest("different system head cannot delete other's payment request", async () => {
    assert.ok(oneTimeRequestId, "One-time payment request id is required");
    const deleteOtherSystemHeadToken = await signupOrLoginUser(
      "system_head",
      process.env.SEC_TEST_SECOND_SYSTEM_HEAD_EMAIL || "security-test-system-head-2@example.com",
      SYSTEM_HEAD_PASSWORD
    );
    const deleteOtherResult = await deleteOneTimePaymentRequest(deleteOtherSystemHeadToken, oneTimeRequestId);
    assertStatus(deleteOtherResult.response, 403, "Different system head should not delete another's payment request");
  });

  await runTest("optional payments endpoint returns requests array", async () => {
    assert.ok(userToken, "User token is required");
    const optionalPayments = await getOptionalUserPayments(userToken);
    assert.ok(Array.isArray(optionalPayments), "Optional payments should return a requests array");
  });

  console.log(`Completed ${totalTests} tests with ${failures.length} failure(s).`);
  return { totalTests, failures };
}

async function main() {
  let result = { totalTests: 0, failures: [] };
  try {
    result = await run();
    if (result.failures.length === 0) {
      console.log("Security test completed successfully.");
    } else {
      console.error("Security test completed with failures:");
      result.failures.forEach((failure, index) => {
        console.error(`${index + 1}. ${failure.name}: ${failure.error}`);
      });
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("Security test failed:", error.message || error);
    process.exitCode = 1;
  } finally {
    await cleanupTestData();
  }
}

main();
