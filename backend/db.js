import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { MongoClient } from "mongodb";
import { MONGODB_CONNECTION_STRING, MONGODB_DB_NAME, SALT_ROUNDS } from "./config.js";
import { normalizeEmail } from "./utils.js";

let usersCollection;
let eventsCollection;
let fixedPaymentRequestsCollection;
let oneTimePaymentRequestsCollection;
let recurringPaymentRequestsCollection;
let banksCollection;
let paymentProcessedCollection;
let mongoReady = false;

function resolveMongoUri() {
  if (!MONGODB_CONNECTION_STRING) {
    throw new Error("Missing MONGODB_CONNECTION_STRING in backend/.env");
  }
  return MONGODB_CONNECTION_STRING;
}

export function getUsersCollection() {
  if (!usersCollection) {
    const error = new Error("MongoDB is not connected yet");
    error.status = 503;
    throw error;
  }
  return usersCollection;
}

export function getEventsCollection() {
  if (!eventsCollection) {
    const error = new Error("MongoDB is not connected yet");
    error.status = 503;
    throw error;
  }
  return eventsCollection;
}

export function getFixedPaymentRequestsCollection() {
  if (!fixedPaymentRequestsCollection) {
    const error = new Error("MongoDB is not connected yet");
    error.status = 503;
    throw error;
  }
  return fixedPaymentRequestsCollection;
}

export function getOneTimePaymentRequestsCollection() {
  if (!oneTimePaymentRequestsCollection) {
    const error = new Error("MongoDB is not connected yet");
    error.status = 503;
    throw error;
  }
  return oneTimePaymentRequestsCollection;
}

export function getRecurringPaymentRequestsCollection() {
  if (!recurringPaymentRequestsCollection) {
    const error = new Error("MongoDB is not connected yet");
    error.status = 503;
    throw error;
  }
  return recurringPaymentRequestsCollection;
}

export function getBanksCollection() {
  if (!banksCollection) {
    const error = new Error("MongoDB is not connected yet");
    error.status = 503;
    throw error;
  }
  return banksCollection;
}

export function getPaymentProcessedCollection() {
  if (!paymentProcessedCollection) {
    const error = new Error("MongoDB is not connected yet");
    error.status = 503;
    throw error;
  }
  return paymentProcessedCollection;
}

export function isMongoReady() {
  return mongoReady;
}

export async function findUserByEmail(email) {
  return getUsersCollection().findOne({ email: normalizeEmail(email) });
}

export async function findUserById(id) {
  return getUsersCollection().findOne({ id });
}

export async function listAllUsersByRole(role) {
  return getUsersCollection()
    .find({ role })
    .project({ _id: 0, id: 1, email: 1, name: 1, rollNo: 1 })
    .toArray();
}

export async function createUserRecord(user) {
  await getUsersCollection().insertOne(user);
  return user;
}

export async function createEventRecord(event) {
  await getEventsCollection().insertOne(event);
  return event;
}

export async function createFixedPaymentRequestRecord(paymentRequest) {
  await getFixedPaymentRequestsCollection().insertOne(paymentRequest);
  return paymentRequest;
}

export async function createOneTimePaymentRequestRecord(paymentRequest) {
  await getOneTimePaymentRequestsCollection().insertOne(paymentRequest);
  return paymentRequest;
}

export async function createOneTimePaymentRequestRecords(paymentRequests) {
  if (!Array.isArray(paymentRequests) || !paymentRequests.length) {
    return [];
  }

  await getOneTimePaymentRequestsCollection().insertMany(paymentRequests);
  return paymentRequests;
}

export async function createRecurringPaymentRequestRecord(paymentRequest) {
  await getRecurringPaymentRequestsCollection().insertOne(paymentRequest);
  return paymentRequest;
}

export async function createPaymentProcessedRecord(paymentRecord) {
  await getPaymentProcessedCollection().insertOne(paymentRecord);
  return paymentRecord;
}

export async function findPaymentProcessedById(paymentRecordId) {
  return getPaymentProcessedCollection().findOne({ id: paymentRecordId });
}

export async function updatePaymentProcessedById(paymentRecordId, updateFields) {
  const update = {
    ...updateFields,
    updatedAt: new Date().toISOString(),
  };

  const result = await getPaymentProcessedCollection().findOneAndUpdate(
    { id: paymentRecordId },
    { $set: update },
    {
      returnDocument: "after",
      projection: { _id: 0 },
    }
  );

  if (!result) {
    return null;
  }

  return result.value || result;
}

export async function listPaymentProcessedByUserId(userId) {
  return getPaymentProcessedCollection()
    .find({ "student.userId": userId })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function listPaymentProcessedByPaymentRequestIds(paymentRequestIds) {
  const ids = Array.isArray(paymentRequestIds)
    ? [...new Set(paymentRequestIds.map((id) => String(id || "").trim()).filter(Boolean))]
    : [];

  if (!ids.length) {
    return [];
  }

  return getPaymentProcessedCollection()
    .find({ paymentRequestId: { $in: ids } })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function listPaymentRequestContextsByIds(paymentRequestIds) {
  const ids = Array.isArray(paymentRequestIds)
    ? [...new Set(paymentRequestIds.map((id) => String(id || "").trim()).filter(Boolean))]
    : [];

  if (!ids.length) {
    return [];
  }

  const [fixedRequests, oneTimeRequests, recurringRequests] = await Promise.all([
    getFixedPaymentRequestsCollection().find({ id: { $in: ids } }).toArray(),
    getOneTimePaymentRequestsCollection().find({ id: { $in: ids } }).toArray(),
    getRecurringPaymentRequestsCollection().find({ id: { $in: ids } }).toArray(),
  ]);

  return [
    ...fixedRequests.map((request) => ({
      paymentRequestId: request.id,
      eventId: request.eventId,
      createdBySystemHeadId: request.createdBySystemHeadId,
      type: request.type,
    })),
    ...oneTimeRequests.map((request) => ({
      paymentRequestId: request.id,
      eventId: request.eventId,
      createdBySystemHeadId: request.createdBySystemHeadId,
      type: request.type,
    })),
    ...recurringRequests.map((request) => ({
      paymentRequestId: request.id,
      eventId: request.eventId,
      createdBySystemHeadId: request.createdBySystemHeadId,
      type: request.type,
    })),
  ];
}

export async function updatePaymentRequestStatusById(paymentRequestId, status) {
  const update = {
    status,
    updatedAt: new Date().toISOString(),
  };

  const [oneTimeResult, fixedResult, recurringResult] = await Promise.all([
    getOneTimePaymentRequestsCollection().findOneAndUpdate(
      { id: paymentRequestId },
      { $set: update },
      { returnDocument: "after", projection: { _id: 0 } }
    ),
    getFixedPaymentRequestsCollection().findOneAndUpdate(
      { id: paymentRequestId },
      { $set: update },
      { returnDocument: "after", projection: { _id: 0 } }
    ),
    getRecurringPaymentRequestsCollection().findOneAndUpdate(
      { id: paymentRequestId },
      { $set: update },
      { returnDocument: "after", projection: { _id: 0 } }
    ),
  ]);

  const oneTime = oneTimeResult?.value || oneTimeResult || null;
  const fixed = fixedResult?.value || fixedResult || null;
  const recurring = recurringResult?.value || recurringResult || null;
  return oneTime || fixed || recurring || null;
}

export async function listPaymentRequestIdsBySystemHead(systemHeadId, eventId) {
  const query = { createdBySystemHeadId: systemHeadId };
  const normalizedEventId = String(eventId || "").trim();
  if (normalizedEventId) {
    query.eventId = normalizedEventId;
  }

  const [fixedIds, oneTimeIds, recurringIds] = await Promise.all([
    getFixedPaymentRequestsCollection()
      .find(query, { projection: { _id: 0, id: 1 } })
      .toArray(),
    getOneTimePaymentRequestsCollection()
      .find(query, { projection: { _id: 0, id: 1 } })
      .toArray(),
    getRecurringPaymentRequestsCollection()
      .find(query, { projection: { _id: 0, id: 1 } })
      .toArray(),
  ]);

  return [...new Set([...fixedIds, ...oneTimeIds, ...recurringIds].map((row) => String(row.id || "").trim()).filter(Boolean))];
}

export async function listOneTimePaymentRequestsByBatchId(batchId, systemHeadId) {
  return getOneTimePaymentRequestsCollection()
    .find({ batchId, createdBySystemHeadId: systemHeadId })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function listOneTimePaymentRequestsByRollNo(rollNo) {
  return getOneTimePaymentRequestsCollection()
    .find({ rollNo })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function listAllFixedPaymentRequests() {
  return getFixedPaymentRequestsCollection()
    .find({})
    .sort({ createdAt: -1 })
    .toArray();
}

export async function findOneTimePaymentRequestById(paymentRequestId) {
  return getOneTimePaymentRequestsCollection().findOne({ id: paymentRequestId });
}

export async function findFixedPaymentRequestById(paymentRequestId) {
  return getFixedPaymentRequestsCollection().findOne({ id: paymentRequestId });
}

export async function findRecurringPaymentRequestById(paymentRequestId) {
  return getRecurringPaymentRequestsCollection().findOne({ id: paymentRequestId });
}

export async function listAllRecurringPaymentRequests() {
  return getRecurringPaymentRequestsCollection()
    .find({})
    .sort({ createdAt: -1 })
    .toArray();
}

export async function listRecurringPaymentRequestsForExecution() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return getRecurringPaymentRequestsCollection()
    .find({
      status: "active",
      nextExecutionDate: { $lte: today.toISOString() },
    })
    .toArray();
}

export async function updateRecurringPaymentRequestById(paymentRequestId, updateFields) {
  const update = {
    ...updateFields,
    updatedAt: new Date().toISOString(),
  };

  const result = await getRecurringPaymentRequestsCollection().findOneAndUpdate(
    { id: paymentRequestId },
    { $set: update },
    {
      returnDocument: "after",
      projection: { _id: 0 },
    }
  );

  if (!result) {
    return null;
  }

  return result.value || result;
}

export async function deleteRecurringPaymentRequestById(paymentRequestId) {
  const result = await getRecurringPaymentRequestsCollection().deleteOne({
    id: paymentRequestId,
  });
  return result.deletedCount > 0;
}

export async function deleteFixedPaymentRequestById(paymentRequestId) {
  const result = await getFixedPaymentRequestsCollection().deleteOne({
    id: paymentRequestId,
  });
  return result.deletedCount > 0;
}

export async function updateRecurringEventInstanceCounter(templateEventId, newCounter) {
  const result = await getEventsCollection().findOneAndUpdate(
    { id: templateEventId },
    { $set: { instanceCounter: newCounter, updatedAt: new Date().toISOString() } },
    { returnDocument: "after", projection: { _id: 0 } }
  );
  return result;
}

export async function markEventAsRecurringTemplate(eventId) {
  const result = await getEventsCollection().findOneAndUpdate(
    { id: eventId },
    { 
      $set: { 
        type: "recurring", 
        instanceCounter: 0, 
        updatedAt: new Date().toISOString() 
      } 
    },
    { returnDocument: "after", projection: { _id: 0 } }
  );
  return result;
}

export async function deleteOneTimePaymentRequestById(paymentRequestId) {
  const result = await getOneTimePaymentRequestsCollection().deleteOne({
    id: paymentRequestId,
  });
  return result.deletedCount > 0;
}

export async function listBanks() {
  return getBanksCollection().find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
}

export async function findBankById(bankId) {
  return getBanksCollection().findOne({ id: bankId }, { projection: { _id: 0 } });
}

export async function findBankByDisplayName(displayName) {
  const normalized = String(displayName || "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return getBanksCollection().findOne({ normalizedDisplayName: normalized }, { projection: { _id: 0 } });
}

export async function createBankRecord(bank) {
  await getBanksCollection().insertOne(bank);
  return bank;
}

export async function updateBankRecordById(bankId, update) {
  const result = await getBanksCollection().findOneAndUpdate(
    { id: bankId },
    { $set: update },
    {
      returnDocument: "after",
      projection: { _id: 0 },
    }
  );

  if (!result) {
    return null;
  }

  return result.value || result;
}

export async function deleteBankRecordById(bankId) {
  return getBanksCollection().deleteOne({ id: bankId });
}

export async function listEventsByIds(eventIds) {
  const ids = Array.isArray(eventIds)
    ? [...new Set(eventIds.map((id) => String(id || "").trim()).filter(Boolean))]
    : [];

  if (!ids.length) {
    return [];
  }

  return getEventsCollection()
    .find({ id: { $in: ids } })
    .project({ _id: 0, id: 1, name: 1, description: 1 })
    .toArray();
}

export async function listEventsBySystemHeadId(systemHeadId) {
  return getEventsCollection()
    .find({ createdBySystemHeadId: systemHeadId })
    .sort({ createdAt: -1 })
    .toArray();
}

function mergeLatestRequestsByEventId(requests, latestByEventId) {
  requests.forEach((request) => {
    const eventId = String(request.eventId || "").trim();
    if (!eventId) {
      return;
    }

    const existing = latestByEventId.get(eventId);
    const requestTime = new Date(request.createdAt || 0).getTime();
    const existingTime = new Date(existing?.createdAt || 0).getTime();
    
    if (!existing || requestTime > existingTime || 
        (requestTime === existingTime && request.type === "recurring")) {
      latestByEventId.set(eventId, request);
    }
  });
}

export async function findLatestPaymentRequestByEventAndSystemHead(eventId, systemHeadId) {
  const [fixedRequest, oneTimeRequest, recurringRequest] = await Promise.all([
    getFixedPaymentRequestsCollection()
      .find({ eventId, createdBySystemHeadId: systemHeadId })
      .sort({ createdAt: -1 })
      .limit(1)
      .next(),
    getOneTimePaymentRequestsCollection()
      .find({ eventId, createdBySystemHeadId: systemHeadId })
      .sort({ createdAt: -1 })
      .limit(1)
      .next(),
    getRecurringPaymentRequestsCollection()
      .find({ eventId, createdBySystemHeadId: systemHeadId })
      .sort({ createdAt: -1 })
      .limit(1)
      .next(),
  ]);

  const requests = [fixedRequest, oneTimeRequest, recurringRequest].filter(Boolean);
  if (!requests.length) return null;

  return requests.reduce((latest, current) => 
    new Date(current.createdAt || 0).getTime() > new Date(latest.createdAt || 0).getTime() ? current : latest
  );
}

export async function getLatestPaymentRequestTypeByEventIds(eventIds, systemHeadId) {
  const ids = Array.isArray(eventIds)
    ? [...new Set(eventIds.map((id) => String(id || "").trim()).filter(Boolean))]
    : [];

  if (!ids.length) {
    return new Map();
  }

  const [fixedRequests, oneTimeRequests, recurringRequests] = await Promise.all([
    getFixedPaymentRequestsCollection()
      .find({ eventId: { $in: ids }, createdBySystemHeadId: systemHeadId })
      .sort({ createdAt: -1 })
      .toArray(),
    getOneTimePaymentRequestsCollection()
      .find({ eventId: { $in: ids }, createdBySystemHeadId: systemHeadId })
      .sort({ createdAt: -1 })
      .toArray(),
    getRecurringPaymentRequestsCollection()
      .find({ eventId: { $in: ids }, createdBySystemHeadId: systemHeadId })
      .sort({ createdAt: -1 })
      .toArray(),
  ]);

  const latestByEventId = new Map();
  mergeLatestRequestsByEventId(fixedRequests, latestByEventId);
  mergeLatestRequestsByEventId(oneTimeRequests, latestByEventId);
  mergeLatestRequestsByEventId(recurringRequests, latestByEventId);

  const typeByEventId = new Map();
  latestByEventId.forEach((request, eventId) => {
    typeByEventId.set(eventId, String(request.type || "").trim().toLowerCase() || null);
  });

  return typeByEventId;
}

export async function getAllPaymentRequestTypesByEventIds(eventIds, systemHeadId) {
  const ids = Array.isArray(eventIds)
    ? [...new Set(eventIds.map((id) => String(id || "").trim()).filter(Boolean))]
    : [];

  if (!ids.length) {
    return new Map();
  }

  const [fixedRequests, oneTimeRequests, recurringRequests] = await Promise.all([
    getFixedPaymentRequestsCollection()
      .find({ eventId: { $in: ids }, createdBySystemHeadId: systemHeadId })
      .toArray(),
    getOneTimePaymentRequestsCollection()
      .find({ eventId: { $in: ids }, createdBySystemHeadId: systemHeadId })
      .toArray(),
    getRecurringPaymentRequestsCollection()
      .find({ eventId: { $in: ids }, createdBySystemHeadId: systemHeadId })
      .toArray(),
  ]);

  const typesByEventId = new Map();

  fixedRequests.forEach((request) => {
    const eventId = String(request.eventId || "").trim();
    if (eventId) {
      if (!typesByEventId.has(eventId)) {
        typesByEventId.set(eventId, new Set());
      }
      typesByEventId.get(eventId).add("fixed");
    }
  });

  oneTimeRequests.forEach((request) => {
    const eventId = String(request.eventId || "").trim();
    if (eventId) {
      if (!typesByEventId.has(eventId)) {
        typesByEventId.set(eventId, new Set());
      }
      typesByEventId.get(eventId).add("one_time");
    }
  });

  recurringRequests.forEach((request) => {
    const eventId = String(request.eventId || "").trim();
    if (eventId) {
      if (!typesByEventId.has(eventId)) {
        typesByEventId.set(eventId, new Set());
      }
      typesByEventId.get(eventId).add("recurring");
    }
  });

  return typesByEventId;
}

export async function findEventByIdForSystemHead(eventId, systemHeadId) {
  return getEventsCollection().findOne({ id: eventId, createdBySystemHeadId: systemHeadId });
}

export async function markEventDone(eventId, systemHeadId) {
  const result = await getEventsCollection().updateOne(
    { id: eventId, createdBySystemHeadId: systemHeadId },
    {
      $set: {
        isOngoing: false,
        updatedAt: new Date().toISOString(),
      },
    }
  );

  if (!result.matchedCount) {
    return null;
  }

  return findEventByIdForSystemHead(eventId, systemHeadId);
}

export async function deleteEventById(eventId, systemHeadId) {
  const eventDeleteResult = await getEventsCollection().deleteOne({
    id: eventId,
    createdBySystemHeadId: systemHeadId,
  });

  if (!eventDeleteResult.deletedCount) {
    return eventDeleteResult;
  }

  await Promise.all([
    getFixedPaymentRequestsCollection().deleteMany({
      eventId,
      createdBySystemHeadId: systemHeadId,
    }),
    getOneTimePaymentRequestsCollection().deleteMany({
      eventId,
      createdBySystemHeadId: systemHeadId,
    }),
    getRecurringPaymentRequestsCollection().deleteMany({
      eventId,
      createdBySystemHeadId: systemHeadId,
    }),
  ]);

  return eventDeleteResult;
}

async function connectMongo() {
  const uri = resolveMongoUri();
  const mongoClient = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });
  await mongoClient.connect();

  const db = mongoClient.db(MONGODB_DB_NAME);
  usersCollection = db.collection("users");
  eventsCollection = db.collection("Events");
  fixedPaymentRequestsCollection = db.collection("Fixed_Payment_Request");
  oneTimePaymentRequestsCollection = db.collection("One_Time_Payment_Request");
  recurringPaymentRequestsCollection = db.collection("Recurring_Payment_Request");
  banksCollection = db.collection("Banks");
  paymentProcessedCollection = db.collection("Payment_Processed");
  mongoReady = true;

  await usersCollection.createIndex({ id: 1 }, { unique: true });
  await usersCollection.createIndex({ email: 1 }, { unique: true });
  await usersCollection.createIndex({ role: 1 });
  await usersCollection.createIndex({ ICICI_merchantId: 1 }, { unique: true, sparse: true });
  await eventsCollection.createIndex({ id: 1 }, { unique: true });
  await eventsCollection.createIndex({ createdBySystemHeadId: 1 });
  await eventsCollection.createIndex({ isOngoing: 1 });
  await fixedPaymentRequestsCollection.createIndex({ id: 1 }, { unique: true });
  await fixedPaymentRequestsCollection.createIndex({ eventId: 1, createdBySystemHeadId: 1 });
  await oneTimePaymentRequestsCollection.createIndex({ id: 1 }, { unique: true });
  await oneTimePaymentRequestsCollection.createIndex({ eventId: 1, createdBySystemHeadId: 1 });
  await recurringPaymentRequestsCollection.createIndex({ id: 1 }, { unique: true });
  await recurringPaymentRequestsCollection.createIndex({ eventId: 1, createdBySystemHeadId: 1 });
  await recurringPaymentRequestsCollection.createIndex({ status: 1, nextExecutionDate: 1 });
  await banksCollection.createIndex({ id: 1 }, { unique: true });
  await banksCollection.createIndex({ normalizedDisplayName: 1 }, { unique: true });
  await paymentProcessedCollection.createIndex({ id: 1 }, { unique: true });
  await paymentProcessedCollection.createIndex({ paymentRequestId: 1 });
  await paymentProcessedCollection.createIndex({ "student.userId": 1 });
  await paymentProcessedCollection.createIndex({ createdAt: -1 });
}

export async function bootstrapAdmin() {
  const email = normalizeEmail(process.env.ADMIN_EMAIL || "admin@iith.ac.in");
  const password = String(process.env.ADMIN_PASSWORD || "ChangeMe@123");

  const already = await getUsersCollection().findOne({ role: "admin" });
  if (already) return;

  const user = {
    id: crypto.randomUUID(),
    name: "Admin",
    email,
    role: "admin",
    passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
    mustChangePassword: true,
    authProvider: "local",
    createdBy: "bootstrap",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await createUserRecord(user);
  console.log(`Bootstrapped admin: ${email}`);
}

export async function connectMongoWithRetry(attempt = 1) {
  try {
    await connectMongo();
    await bootstrapAdmin();
    console.log("MongoDB connected");
  } catch (error) {
    mongoReady = false;
    usersCollection = undefined;
    eventsCollection = undefined;
    fixedPaymentRequestsCollection = undefined;
    oneTimePaymentRequestsCollection = undefined;
    recurringPaymentRequestsCollection = undefined;
    banksCollection = undefined;
    paymentProcessedCollection = undefined;
    const delayMs = Math.min(30000, attempt * 3000);
    console.error(
      "MongoDB connect failed (attempt " + attempt + "). Retrying in " + Math.round(delayMs / 1000) + "s",
      error?.message || error
    );
    setTimeout(() => {
      connectMongoWithRetry(attempt + 1);
    }, delayMs);
  }
}
