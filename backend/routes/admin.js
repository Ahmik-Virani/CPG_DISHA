import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { SALT_ROUNDS } from "../config.js";
import { createUserRecord, getUsersCollection } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { normalizeEmail } from "../utils.js";

const router = Router();

router.get("/system-heads", requireAuth, requireRole("admin"), async (_req, res) => {
  const users = await getUsersCollection()
    .find({ role: "system_head" }, { projection: { passwordHash: 0, _id: 0 } })
    .sort({ createdAt: -1 })
    .toArray();

  return res.json({ users });
});

router.post("/system-heads", requireAuth, requireRole("admin"), async (req, res) => {
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
    role: "system_head",
    passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
    mustChangePassword: true,
    authProvider: "local",
    createdBy: req.auth.sub,
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

  const { passwordHash, ...safeUser } = user;
  return res.status(201).json({ user: safeUser });
});

export default router;
