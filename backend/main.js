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
const ROLES = ["admin", "user"];
const SALT_ROUNDS = 10;

let usersCollection;
let mongoReady = false;

app.use(cors());
app.use(express.json());

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

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

async function connectMongo() {
  const uri = resolveMongoUri();
  const mongoClient = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });
  await mongoClient.connect();

  const db = mongoClient.db(MONGODB_DB_NAME);
  usersCollection = db.collection("users");
  mongoReady = true;

  await usersCollection.createIndex({ id: 1 }, { unique: true });
  await usersCollection.createIndex({ email: 1 }, { unique: true });
  await usersCollection.createIndex({ role: 1 });
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

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required" });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }

  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    role: "user",
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
