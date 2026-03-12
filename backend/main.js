import dns from "node:dns";

dns.setServers(["8.8.8.8", "8.8.4.4"]);
dns.setDefaultResultOrder("ipv4first");


import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || "dev-jwt-secret-change-me";
const MONGODB_CONNECTION_STRING = String(process.env.MONGODB_CONNECTION_STRING || "").trim();
const MONGODB_USER_ID = String(
  process.env.MONGODB_USER_ID || process.env.MONGODO_USER_ID || ""
).trim();
const MONGODB_PWD = String(process.env.MONGODB_PWD || "").trim();
const MONGODB_DB_NAME = String(process.env.MONGODB_DB_NAME || "cpg_disha").trim();
const ROLES = ["admin", "user", "system_head"];
const SELF_SIGNUP_ROLES = ["user", "system_head"];
const SALT_ROUNDS = 10;
const PAYMENT_BANKS = ["ICICI", "SBI", "HDFC"];

let usersCollection;
let eventsCollection;
let fixedPaymentRequestsCollection;
let oneTimePaymentRequestsCollection;
let mongoReady = false;

app.use(cors());
app.use(express.json());

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const normalizeRollNo = (rollNo) => String(rollNo || "").toUpperCase().replace(/\s+/g, "").trim();

function normalizeBanks(banks) {
  if (!Array.isArray(banks)) {
    return [];
  }

  const allowed = new Set(PAYMENT_BANKS);
  const normalized = banks
    .map((bank) => String(bank || "").trim().toUpperCase())
    .filter((bank) => allowed.has(bank));

  return [...new Set(normalized)];
}

function stripPassword(user) {
  const { _id, passwordHash, ...safeUser } = user;
  return safeUser;
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
}

function resolveMongoUri() {
  if (!MONGODB_CONNECTION_STRING) {
    throw new Error("Missing MONGODB_CONNECTION_STRING in backend/.env");
  }

  let uri = MONGODB_CONNECTION_STRING;
  return uri;
}

function getUsersCollection() {
  if (!usersCollection) {
    const error = new Error("MongoDB is not connected yet");
    error.status = 503;
    throw error;
  }
  return usersCollection;
}

function getEventsCollection() {
  if (!eventsCollection) {
    const error = new Error("MongoDB is not connected yet");
    error.status = 503;
    throw error;
  }
  return eventsCollection;
}

function getFixedPaymentRequestsCollection() {
  if (!fixedPaymentRequestsCollection) {
    const error = new Error("MongoDB is not connected yet");
    error.status = 503;
    throw error;
  }
  return fixedPaymentRequestsCollection;
}

function getOneTimePaymentRequestsCollection() {
  if (!oneTimePaymentRequestsCollection) {
    const error = new Error("MongoDB is not connected yet");
    error.status = 503;
    throw error;
  }
  return oneTimePaymentRequestsCollection;
}

async function findUserByEmail(email) {
  return getUsersCollection().findOne({ email: normalizeEmail(email) });
}

async function findUserById(id) {
  return getUsersCollection().findOne({ id });
}

async function createUserRecord(user) {
  await getUsersCollection().insertOne(user);
  return user;
}

async function createEventRecord(event) {
  await getEventsCollection().insertOne(event);
  return event;
}

async function createFixedPaymentRequestRecord(paymentRequest) {
  await getFixedPaymentRequestsCollection().insertOne(paymentRequest);
  return paymentRequest;
}

async function createOneTimePaymentRequestRecord(paymentRequest) {
  await getOneTimePaymentRequestsCollection().insertOne(paymentRequest);
  return paymentRequest;
}

async function listEventsBySystemHeadId(systemHeadId) {
  return getEventsCollection()
    .find({ createdBySystemHeadId: systemHeadId })
    .sort({ createdAt: -1 })
    .toArray();
}

async function findEventByIdForSystemHead(eventId, systemHeadId) {
  return getEventsCollection().findOne({ id: eventId, createdBySystemHeadId: systemHeadId });
}

async function markEventDone(eventId, systemHeadId) {
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

async function deleteEventById(eventId, systemHeadId) {
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

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return res.status(401).json({ message: "Missing access token" });
  }

  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.auth || !allowedRoles.includes(req.auth.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    return next();
  };
}

async function bootstrapAdmin() {
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

app.get("/health", async (_req, res) => {
  if (!mongoReady) {
    return res.status(503).json({
      ok: false,
      db: "disconnected",
      message: "Backend is running, waiting for MongoDB connection",
    });
  }

  const users = await getUsersCollection().countDocuments();
  return res.json({ ok: true, users, db: "connected" });
});

app.post("/auth/login", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const user = await findUserByEmail(email);
  if (!user || !user.passwordHash) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  return res.json({ token: signToken(user), user: stripPassword(user) });
});

app.post("/auth/signup", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");
  const role = String(req.body?.role || "user").trim();
  const roll_no = role === "user" ? String(req.body?.roll_no || "").trim().toUpperCase() : undefined;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required" });
  }

  if (role === "user" && !roll_no) {
    return res.status(400).json({ message: "Roll number is required for users" });
  }

  if (!ROLES.includes(role) || !SELF_SIGNUP_ROLES.includes(role)) {
    return res.status(400).json({ message: "Invalid signup role" });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }

  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    role,
    ...(roll_no && { roll_no }),
    passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
    mustChangePassword: false,
    authProvider: "local",
    createdBy: "self-signup",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await createUserRecord(user);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Email already exists" });
    }
    throw error;
  }

  return res.status(201).json({ token: signToken(user), user: stripPassword(user) });
});

app.post("/auth/change-password", requireAuth, async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || "");
  const newPassword = String(req.body?.newPassword || "");

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Current and new password are required" });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ message: "New password must be at least 8 characters" });
  }

  const user = await findUserById(req.auth.sub);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: "Current password is incorrect" });
  }

  await getUsersCollection().updateOne(
    { id: user.id },
    {
      $set: {
        passwordHash: await bcrypt.hash(newPassword, SALT_ROUNDS),
        mustChangePassword: false,
        updatedAt: new Date().toISOString(),
      },
    }
  );

  return res.json({ message: "Password changed successfully" });
});

app.get("/auth/me", requireAuth, async (req, res) => {
  const user = await findUserById(req.auth.sub);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  return res.json({ user: stripPassword(user) });
});

app.get("/events", requireAuth, requireRole("system_head"), async (req, res) => {
  const events = await listEventsBySystemHeadId(req.auth.sub);
  return res.json({ events });
});

app.get("/events/:eventId", requireAuth, requireRole("system_head"), async (req, res) => {
  const event = await findEventByIdForSystemHead(req.params.eventId, req.auth.sub);

  if (!event) {
    return res.status(404).json({ message: "Event not found" });
  }

  return res.json({ event });
});

app.post("/events", requireAuth, requireRole("system_head"), async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const description = String(req.body?.description || "").trim();

  if (!name || !description) {
    return res.status(400).json({ message: "Event name and description are required" });
  }

  const systemHead = await findUserById(req.auth.sub);
  if (!systemHead) {
    return res.status(404).json({ message: "System head not found" });
  }

  const event = {
    id: crypto.randomUUID(),
    name,
    description,
    createdBySystemHeadId: req.auth.sub,
    createdBySystemHeadName: systemHead.name,
    isOngoing: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await createEventRecord(event);

  return res.status(201).json({ event });
});

app.patch("/events/:eventId/complete", requireAuth, requireRole("system_head"), async (req, res) => {
  const event = await markEventDone(req.params.eventId, req.auth.sub);

  if (!event) {
    return res.status(404).json({ message: "Event not found" });
  }

  return res.json({ event });
});

app.delete("/events/:eventId", requireAuth, requireRole("system_head"), async (req, res) => {
  const result = await deleteEventById(req.params.eventId, req.auth.sub);

  if (!result.deletedCount) {
    return res.status(404).json({ message: "Event not found" });
  }

  return res.json({ message: "Event deleted successfully" });
});

app.post(
  "/events/:eventId/payment-requests",
  requireAuth,
  requireRole("system_head"),
  async (req, res) => {
    const eventId = String(req.params?.eventId || "").trim();
    const systemHeadId = req.auth.sub;
    const type = String(req.body?.type || "").trim().toLowerCase();
    const banks = normalizeBanks(req.body?.banks);

    const event = await findEventByIdForSystemHead(eventId, systemHeadId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (!["one_time", "fixed"].includes(type)) {
      return res.status(400).json({ message: "type must be one of one_time or fixed" });
    }

    if (!banks.length) {
      return res.status(400).json({ message: "banks must include at least one valid bank" });
    }

    if (type === "one_time") {
      const rollNo = normalizeRollNo(req.body?.rollNo);
      const amount = Number(req.body?.amount);
      const ttlRaw = String(req.body?.timeToLive || "").trim();
      const ttl = new Date(ttlRaw);

      if (!rollNo || !Number.isFinite(amount) || amount <= 0 || !ttlRaw || Number.isNaN(ttl.getTime())) {
        return res.status(400).json({
          message: "rollNo, amount, and timeToLive are required for one_time requests",
        });
      }

      const now = new Date().toISOString();
      const paymentRequest = {
        id: crypto.randomUUID(),
        createdBySystemHeadId: systemHeadId,
        eventId,
        type: "one_time",
        rollNo,
        banks,
        amount,
        status: "pending",
        timeToLive: ttl.toISOString(),
        createdAt: now,
        updatedAt: now,
      };

      await createOneTimePaymentRequestRecord(paymentRequest);
      return res.status(201).json({ paymentRequest, table: "One_Time_Payment_Request" });
    }

    const isAmountFixed = req.body?.isAmountFixed;
    if (typeof isAmountFixed !== "boolean") {
      return res.status(400).json({ message: "isAmountFixed must be a boolean for fixed requests" });
    }

    const amount = Number(req.body?.amount);
    if (isAmountFixed && (!Number.isFinite(amount) || amount <= 0)) {
      return res.status(400).json({ message: "amount must be greater than 0 when isAmountFixed is true" });
    }

    const now = new Date().toISOString();
    const paymentRequest = {
      id: crypto.randomUUID(),
      createdBySystemHeadId: systemHeadId,
      eventId,
      type: "fixed",
      banks,
      isAmountFixed,
      amount: isAmountFixed ? amount : null,
      createdAt: now,
      updatedAt: now,
    };

    await createFixedPaymentRequestRecord(paymentRequest);
    return res.status(201).json({ paymentRequest, table: "Fixed_Payment_Request" });
  }
);

app.use((error, _req, res, _next) => {
  console.error(error);
  const status = Number(error?.status) || 500;
  if (status === 503) {
    return res.status(503).json({ message: "Database unavailable. Please retry shortly." });
  }
  return res.status(500).json({ message: "Internal server error" });
});

async function connectMongoWithRetry(attempt = 1) {
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
    console.error("MongoDB connect failed (attempt " + attempt + "). Retrying in " + Math.round(delayMs / 1000) + "s", error?.message || error);
    setTimeout(() => {
      connectMongoWithRetry(attempt + 1);
    }, delayMs);
  }
}

function startServer() {
  app.listen(PORT, () => {
    if (JWT_SECRET === "dev-jwt-secret-change-me") {
      console.warn("Using fallback JWT secret. Set JWT_SECRET in backend/.env");
    }
    console.log("Backend running on http://localhost:" + PORT);
  });

  void connectMongoWithRetry();
}

startServer();
