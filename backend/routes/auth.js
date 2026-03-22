import crypto from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { ROLES, SELF_SIGNUP_ROLES, SALT_ROUNDS } from "../config.js";
import { normalizeEmail, stripPassword, signToken } from "../utils.js";
import { findUserByEmail, findUserById, createUserRecord, getUsersCollection } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

async function generateIciciMerchantId() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    let merchantId = "";
    for (let index = 0; index < 20; index += 1) {
      merchantId += String(crypto.randomInt(0, 10));
    }
    const existing = await getUsersCollection().findOne(
      { ICICI_merchantId: merchantId },
      { projection: { _id: 1 } }
    );

    if (!existing) {
      return merchantId;
    }
  }

  throw new Error("Failed to generate unique ICICI merchant id");
}

router.post("/login", async (req, res) => {
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

router.post("/signup", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");
  const role = String(req.body?.role || "user").trim();
  const roll_no = role === "user" ? String(req.body?.roll_no || "").trim().toUpperCase() : undefined;
  const ICICI_merchantId = role === "system_head" ? await generateIciciMerchantId() : undefined;

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
    ...(ICICI_merchantId && { ICICI_merchantId }),
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
    if (error?.code === 11000 && error?.keyPattern?.email) {
      return res.status(409).json({ message: "Email already exists" });
    }

    if (error?.code === 11000 && error?.keyPattern?.ICICI_merchantId) {
      return res.status(409).json({ message: "Merchant ID generation conflict. Please retry signup." });
    }
    throw error;
  }

  return res.status(201).json({ token: signToken(user), user: stripPassword(user) });
});

router.post("/change-password", requireAuth, async (req, res) => {
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

router.get("/me", requireAuth, async (req, res) => {
  const user = await findUserById(req.auth.sub);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  return res.json({ user: stripPassword(user) });
});

export default router;
