import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { MongoClient } from "mongodb";
import { MONGODB_CONNECTION_STRING, MONGODB_DB_NAME, SALT_ROUNDS } from "./config.js";
import { normalizeEmail } from "./utils.js";

let usersCollection;
let eventsCollection;
let fixedPaymentRequestsCollection;
let oneTimePaymentRequestsCollection;
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

export function isMongoReady() {
  return mongoReady;
}

export async function findUserByEmail(email) {
  return getUsersCollection().findOne({ email: normalizeEmail(email) });
}

export async function findUserById(id) {
  return getUsersCollection().findOne({ id });
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

export async function listEventsByIds(eventIds) {
  const ids = Array.isArray(eventIds)
    ? [...new Set(eventIds.map((id) => String(id || "").trim()).filter(Boolean))]
    : [];

  if (!ids.length) {
    return [];
  }

  return getEventsCollection()
    .find({ id: { $in: ids } })
    .project({ _id: 0, id: 1, name: 1 })
    .toArray();
}

export async function listEventsBySystemHeadId(systemHeadId) {
  return getEventsCollection()
    .find({ createdBySystemHeadId: systemHeadId })
    .sort({ createdAt: -1 })
    .toArray();
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
  return getEventsCollection().deleteOne({ id: eventId, createdBySystemHeadId: systemHeadId });
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
  mongoReady = true;

  await usersCollection.createIndex({ id: 1 }, { unique: true });
  await usersCollection.createIndex({ email: 1 }, { unique: true });
  await usersCollection.createIndex({ role: 1 });
  await eventsCollection.createIndex({ id: 1 }, { unique: true });
  await eventsCollection.createIndex({ createdBySystemHeadId: 1 });
  await eventsCollection.createIndex({ isOngoing: 1 });
  await fixedPaymentRequestsCollection.createIndex({ id: 1 }, { unique: true });
  await fixedPaymentRequestsCollection.createIndex({ eventId: 1, createdBySystemHeadId: 1 });
  await oneTimePaymentRequestsCollection.createIndex({ id: 1 }, { unique: true });
  await oneTimePaymentRequestsCollection.createIndex({ eventId: 1, createdBySystemHeadId: 1 });
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
