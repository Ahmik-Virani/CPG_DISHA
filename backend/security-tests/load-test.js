import assert from "node:assert";
import { randomUUID } from "node:crypto";

const BASE_URL = process.env.BACKEND_URL || "http://localhost:4000";
const SYSTEM_HEAD_EMAIL = process.env.LOAD_TEST_SYSTEM_HEAD_EMAIL || `load-test-system-head+${randomUUID().slice(0, 6)}@example.com`;
const SYSTEM_HEAD_PASSWORD = process.env.LOAD_TEST_SYSTEM_HEAD_PASSWORD || "Test@12345";
const USER_EMAIL = process.env.LOAD_TEST_USER_EMAIL || `load-test-user+${randomUUID().slice(0, 6)}@example.com`;
const USER_PASSWORD = process.env.LOAD_TEST_USER_PASSWORD || "Test@12345";
const USER_ROLL = process.env.LOAD_TEST_USER_ROLL || `LOAD-USER-${randomUUID().slice(0, 6)}`;
const CONCURRENCY = Number(process.env.LOAD_TEST_CONCURRENCY || 20);
const TOTAL_REQUESTS = Number(process.env.LOAD_TEST_REQUESTS || 250);
const DURATION_SECONDS = Number(process.env.LOAD_TEST_DURATION_SECONDS || 30);
const MAX_ERRORS = Number(process.env.LOAD_TEST_MAX_ERRORS || 75);

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

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    ...jsonHeaders,
  };
}

async function loginUser(email, password) {
  const { response, body } = await request("/auth/login", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ email, password }),
  });

  if (response.status !== 200) {
    throw new Error(`Login failed for ${email}: ${response.status} ${JSON.stringify(body)}`);
  }

  return body.token;
}

async function signupOrLoginUser(role, email, password, roll_no) {
  const body = {
    name: `Load Test ${role}`,
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
    return responseBody.token;
  }

  if (response.status === 409) {
    return loginUser(email, password);
  }

  throw new Error(`Signup failed for ${role}: ${response.status} ${JSON.stringify(responseBody)}`);
}

async function createEvent(token, name) {
  const eventName = name || `Load Test Event ${randomUUID().slice(0, 6)}`;
  const { response, body } = await request("/events", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ name: eventName, description: "Load test event" }),
  });

  assert.strictEqual(response.status, 201, "System head should create event successfully");
  return body.event.id;
}

async function getBankOptions(token) {
  const { response, body } = await request("/events/banks/options", {
    method: "GET",
    headers: authHeaders(token),
  });

  assert.strictEqual(response.status, 200, "System head should retrieve bank options");
  assert.ok(Array.isArray(body.banks), "Bank options response should contain banks array");
  return body.banks;
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

  assert.strictEqual(response.status, 201, "System head should create one_time payment request");
  assert.ok(Array.isArray(body.paymentRequests), "Create response should include paymentRequests array");
  return body.paymentRequests[0].id;
}

function assertStatus(response, expected, message) {
  assert.strictEqual(response.status, expected, `${message} (got ${response.status})`);
}

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

async function runLoadTest() {
  if (!globalThis.fetch) {
    throw new Error("Node.js 18+ is required for load-test.js because it uses global fetch.");
  }

  console.log(`Running load test against ${BASE_URL}`);
  console.log(`Concurrency: ${CONCURRENCY}, Total requests: ${TOTAL_REQUESTS}, Duration: ${DURATION_SECONDS}s`);

  const systemHeadToken = await signupOrLoginUser("system_head", SYSTEM_HEAD_EMAIL, SYSTEM_HEAD_PASSWORD);
  const userToken = await signupOrLoginUser("user", USER_EMAIL, USER_PASSWORD, USER_ROLL);

  const eventId = await createEvent(systemHeadToken, `Load Test Event ${randomUUID().slice(0, 6)}`);
  const banks = await getBankOptions(systemHeadToken);
  const bankName = banks[0]?.name;

  if (!bankName) {
    throw new Error("No enabled bank options available for load test.");
  }

  await createOneTimePaymentRequest(systemHeadToken, eventId, bankName, USER_ROLL, 100);

  const flows = [
    { weight: 20, method: "GET", path: "/health", token: null },
    { weight: 25, method: "GET", path: "/events", token: systemHeadToken },
    { weight: 20, method: "GET", path: "/user-payments/pending", token: userToken },
    { weight: 15, method: "GET", path: `/events/${eventId}/payment-requests/latest`, token: systemHeadToken },
    { weight: 10, method: "GET", path: `/events/transactions/history?eventId=${eventId}`, token: systemHeadToken },
    { weight: 10, method: "GET", path: "/user-payments/optional", token: userToken },
  ];

  const totalWeight = flows.reduce((sum, flow) => sum + flow.weight, 0);

  function pickFlow() {
    let target = Math.random() * totalWeight;
    for (const flow of flows) {
      target -= flow.weight;
      if (target <= 0) {
        return flow;
      }
    }
    return flows[flows.length - 1];
  }

  const stats = {
    requests: 0,
    successes: 0,
    failures: 0,
    statusCounts: {},
    errors: 0,
  };

  async function executeFlow(flow) {
    const options = {
      method: flow.method,
      headers: flow.token ? authHeaders(flow.token) : jsonHeaders,
    };

    const start = Date.now();
    try {
      const { response } = await request(flow.path, options);
      const status = response.status;
      stats.statusCounts[status] = (stats.statusCounts[status] || 0) + 1;
      if (status >= 200 && status < 300) {
        stats.successes += 1;
      } else {
        stats.failures += 1;
      }
    } catch (error) {
      stats.failures += 1;
      stats.errors += 1;
      if (stats.errors >= MAX_ERRORS) {
        throw new Error(`Load test aborted after ${stats.errors} network errors: ${error.message}`);
      }
    } finally {
      stats.requests += 1;
    }
    return Date.now() - start;
  }

  const stopAt = Date.now() + DURATION_SECONDS * 1000;

  async function worker() {
    while (Date.now() < stopAt && stats.requests < TOTAL_REQUESTS) {
      const flow = pickFlow();
      await executeFlow(flow);
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  console.log("Load test complete");
  console.log(`Total requests: ${stats.requests}`);
  console.log(`Successes: ${stats.successes}`);
  console.log(`Failures: ${stats.failures}`);
  console.log(`Status counts: ${JSON.stringify(stats.statusCounts)}`);

  if (stats.failures > 0) {
    process.exitCode = 1;
  }
}

runLoadTest().catch((error) => {
  console.error("Load test failed:", error.message || error);
  process.exit(1);
});
