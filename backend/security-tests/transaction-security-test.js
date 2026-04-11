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
  assert.strictEqual(body.paymentRequest.type, "recurring", "Recurring payment request type should be recurring");
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

async function run() {
  if (!globalThis.fetch) {
    throw new Error("This script requires Node.js 18+ or a compatible fetch implementation.");
  }

  console.log(`Running security tests against ${BASE_URL}`);

  const userToken = await signupOrLoginUser("user", USER_EMAIL, USER_PASSWORD, USER_ROLL);
  const systemHeadToken = await signupOrLoginUser("system_head", SYSTEM_HEAD_EMAIL, SYSTEM_HEAD_PASSWORD);

  const systemHeadMe = await getMe(systemHeadToken);
  assert.strictEqual(systemHeadMe.role, "system_head", "Signed in system head should have system_head role");

  const userMe = await getMe(userToken);
  assert.strictEqual(userMe.role, "user", "Signed in user should have user role");
  assert.strictEqual(String(userMe.roll_no).toUpperCase(), String(USER_ROLL).toUpperCase(), "User roll number should match");

  await getHealth();
  console.log("✅ /health is reachable");

  const invalidLogin = await request("/auth/login", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ email: USER_EMAIL, password: "WrongPassword!" }),
  });
  assertStatus(invalidLogin.response, 401, "Invalid login should return 401");
  console.log("✅ invalid login is rejected");

  const missingAuthResult = await request("/events", { method: "GET" });
  assertStatus(missingAuthResult.response, 401, "Missing token should return 401");

  const invalidTokenResult = await request("/events", {
    method: "GET",
    headers: authHeaders("invalid-token"),
  });
  assertStatus(invalidTokenResult.response, 401, "Invalid token should return 401");

  const userForbidden = await request("/events", {
    method: "GET",
    headers: authHeaders(userToken),
  });
  assertStatus(userForbidden.response, 403, "User should not access system_head event route");
  console.log("✅ authentication and role enforcement working");

  const banks = await getBankOptions(systemHeadToken);
  const bankName = banks[0]?.name;
  assert.ok(bankName, "At least one enabled bank must exist for the tests");

  const eventOneTime = await createEvent(systemHeadToken, `OneTime Event ${randomUUID().slice(0, 6)}`);
  const eventFixed = await createEvent(systemHeadToken, `Fixed Event ${randomUUID().slice(0, 6)}`);
  const eventRecurring = await createEvent(systemHeadToken, `Recurring Event ${randomUUID().slice(0, 6)}`);

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

  const oneTimeRequestId = await createOneTimePaymentRequest(systemHeadToken, eventOneTime, bankName, USER_ROLL, 150);
  console.log("✅ one_time payment request created");

  const pendingListBefore = await getPendingUserPayments(userToken);
  assert.ok(pendingListBefore.some((item) => String(item.rollNo).toUpperCase() === String(USER_ROLL).toUpperCase()), "Pending payments should include the user's one-time request");

  const fixedRequestId = await createFixedPaymentRequest(systemHeadToken, eventFixed, bankName, 200);
  console.log("✅ fixed payment request created");

  const recurringRequestId = await createRecurringPaymentRequest(systemHeadToken, eventRecurring, bankName);
  console.log("✅ recurring payment request created");

  const verifyBadRequest = await verifyPaymentStatus(userToken, null, null);
  assertStatus(verifyBadRequest.response, 400, "Missing payment ids should return 400");

  const verifyMissingRecord = await verifyPaymentStatus(userToken, `missing-${randomUUID().slice(0, 6)}`, null);
  assertStatus(verifyMissingRecord.response, 404, "Non-existing payment record should return 404");

  const verifyWithSystemHead = await verifyPaymentStatus(systemHeadToken, oneTimeRequestId, null);
  assertStatus(verifyWithSystemHead.response, 403, "System head should not verify a user payment status");

  const initiateBadBank = await initiateSale(userToken, oneTimeRequestId, "UNKNOWN BANK", TEST_RETURN_URL);
  assertStatus(initiateBadBank.response, 400, "Initiate sale with unknown bank should return 400");

  const initiateMissingReturn = await request("/user-payments/initiate-sale", {
    method: "POST",
    headers: authHeaders(userToken),
    body: JSON.stringify({ paymentRequestId: oneTimeRequestId, bank: bankName }),
  });
  assertStatus(initiateMissingReturn.response, 400, "Missing returnURL should return 400");

  const initiateResponse = await initiateSale(userToken, oneTimeRequestId, bankName, TEST_RETURN_URL);
  assertStatus(initiateResponse.response, 200, "Initiate sale should return 200 when bank config is available");
  assert.strictEqual(initiateResponse.body.status, "pending", "Initiate-sale should return pending status");
  assert.ok(initiateResponse.body.paymentRecordId, "Initiate-sale should return paymentRecordId");
  console.log("✅ initiate-sale created a pending payment record");

  const paymentRecordId = initiateResponse.body.paymentRecordId;

  const pendingListAfterInitiate = await getPendingUserPayments(userToken);
  assert.ok(pendingListAfterInitiate.some((item) => String(item.rollNo).toUpperCase() === String(USER_ROLL).toUpperCase()), "Pending payments should still include the payment request after initiate-sale");

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

    console.log(`✅ verify-status resolved to ${verifyResponse.body.status} and pending list updated correctly`);
  } else {
    const pendingAfterPending = await getPendingUserPayments(userToken);
    assert.ok(pendingAfterPending.some((item) => String(item.rollNo).toUpperCase() === String(USER_ROLL).toUpperCase()), "Pending payments should still include unresolved pending payments");
    console.log("✅ verify-status returned pending and the payment remains visible in pending payments");
  }

  const anotherUserToken = await signupOrLoginUser(
    "user",
    process.env.SEC_TEST_SECOND_USER_EMAIL || "security-test-user-2@example.com",
    USER_PASSWORD,
    process.env.SEC_TEST_SECOND_USER_ROLL || "SEC-USER-2"
  );
  const verifyOtherUser = await verifyPaymentStatus(anotherUserToken, paymentRecordId, null);
  assertStatus(verifyOtherUser.response, 403, "A different user should not verify someone else's payment");

  const eventDetails = await getEventById(eventOneTime, systemHeadToken);
  assert.strictEqual(eventDetails.id, eventOneTime, "Event details endpoint should return the correct event");

  const latestRequest = await getLatestPaymentRequest(eventOneTime, systemHeadToken);
  assert.strictEqual(latestRequest.type, "one_time", "Latest request type should be one_time");

  const transactionHistory = await getSystemHeadTransactionHistory(eventOneTime, systemHeadToken);
  assert.ok(Array.isArray(transactionHistory), "System head transaction history should return an array");

  const deleteOtherSystemHeadToken = await signupOrLoginUser(
    "system_head",
    process.env.SEC_TEST_SECOND_SYSTEM_HEAD_EMAIL || "security-test-system-head-2@example.com",
    SYSTEM_HEAD_PASSWORD
  );
  const deleteOtherResult = await deleteOneTimePaymentRequest(deleteOtherSystemHeadToken, oneTimeRequestId);
  assertStatus(deleteOtherResult.response, 403, "Different system head should not delete another's payment request");

  const optionalPayments = await getOptionalUserPayments(userToken);
  assert.ok(Array.isArray(optionalPayments), "Optional payments should return a requests array");

  console.log("✅ All security and lifecycle tests completed successfully");
}

async function main() {
  try {
    await run();
    console.log("Security test completed successfully.");
  } catch (error) {
    console.error("Security test failed:", error.message || error);
    process.exitCode = 1;
  } finally {
    await cleanupTestData();
  }
}

main();
