import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { SALT_ROUNDS } from "../config.js";
import {
  createBankRecord,
  createUserRecord,
  deleteBankRecordById,
  findBankById,
  listBanks,
  updateBankRecordById,
  getUsersCollection,
} from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { normalizeEmail } from "../utils.js";

const router = Router();

function normalizeBankFields(input) {
  const source = Array.isArray(input) ? input : [];
  const seenKeys = new Set();
  const fields = [];
  let hasNameField = false;

  for (const entry of source) {
    const key = String(entry?.key || "").trim();
    const value = String(entry?.value || "").trim();

    if (!key || !value) {
      continue;
    }

    const loweredKey = key.toLowerCase();
    if (seenKeys.has(loweredKey)) {
      return {
        fields: [],
        error: "Each key should be unique",
      };
    }

    seenKeys.add(loweredKey);
    if (loweredKey === "name") {
      hasNameField = true;
    }
    fields.push({ key, value });
  }

  if (!fields.length) {
    return {
      fields: [],
      error: "At least one key-value pair is required",
    };
  }

  if (!hasNameField) {
    return {
      fields: [],
      error: "name field is required",
    };
  }

  return { fields, error: "" };
}

function toFieldMap(fields) {
  return fields.reduce((acc, field) => {
    acc[field.key] = field.value;
    return acc;
  }, {});
}

function resolveBankDisplayName(fields) {
  const nameCandidates = ["name"];
  const lowered = new Map(fields.map((field) => [field.key.toLowerCase(), field.value]));

  for (const candidate of nameCandidates) {
    const value = String(lowered.get(candidate) || "").trim();
    if (value) {
      return value;
    }
  }

  return "";
}

function toBankView(bank) {
  const fields = Array.isArray(bank?.fields) ? bank.fields : [];
  return {
    id: bank.id,
    displayName: bank.displayName,
    normalizedDisplayName: bank.normalizedDisplayName,
    fields,
    values: toFieldMap(fields),
    createdAt: bank.createdAt,
    updatedAt: bank.updatedAt,
    createdBy: bank.createdBy,
  };
}

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
    if (error?.code === 11000 && error?.keyPattern?.email) {
      return res.status(409).json({ message: "Email already exists" });
    }
    throw error;
  }

  const { passwordHash, ...safeUser } = user;
  return res.status(201).json({ user: safeUser });
});

router.get("/banks", requireAuth, requireRole("admin"), async (_req, res) => {
  const banks = await listBanks();
  return res.json({ banks: banks.map(toBankView) });
});

router.post("/banks", requireAuth, requireRole("admin"), async (req, res) => {
  const { fields, error } = normalizeBankFields(req.body?.fields);

  if (error) {
    return res.status(400).json({ message: error });
  }

  const displayName = resolveBankDisplayName(fields);
  if (!displayName) {
    return res.status(400).json({ message: "Unable to resolve a display name for this bank" });
  }

  const now = new Date().toISOString();
  const bank = {
    id: crypto.randomUUID(),
    displayName,
    normalizedDisplayName: displayName.toLowerCase(),
    fields,
    createdBy: req.auth.sub,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await createBankRecord(bank);
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.normalizedDisplayName) {
      return res.status(409).json({ message: "A bank with the same display name already exists" });
    }
    throw error;
  }

  return res.status(201).json({ bank: toBankView(bank) });
});

router.patch("/banks/:bankId", requireAuth, requireRole("admin"), async (req, res) => {
  const bankId = String(req.params?.bankId || "").trim();
  const existing = await findBankById(bankId);

  if (!existing) {
    return res.status(404).json({ message: "Bank not found" });
  }

  const { fields, error } = normalizeBankFields(req.body?.fields);
  if (error) {
    return res.status(400).json({ message: error });
  }

  const displayName = resolveBankDisplayName(fields);
  if (!displayName) {
    return res.status(400).json({ message: "Unable to resolve a display name for this bank" });
  }

  try {
    const updated = await updateBankRecordById(bankId, {
      displayName,
      normalizedDisplayName: displayName.toLowerCase(),
      fields,
      updatedAt: new Date().toISOString(),
    });

    if (!updated) {
      return res.status(404).json({ message: "Bank not found" });
    }

    return res.json({ bank: toBankView(updated) });
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.normalizedDisplayName) {
      return res.status(409).json({ message: "A bank with the same display name already exists" });
    }
    throw error;
  }
});

router.delete("/banks/:bankId", requireAuth, requireRole("admin"), async (req, res) => {
  const bankId = String(req.params?.bankId || "").trim();
  const result = await deleteBankRecordById(bankId);

  if (!result.deletedCount) {
    return res.status(404).json({ message: "Bank not found" });
  }

  return res.json({ message: "Bank deleted successfully" });
});

export default router;
