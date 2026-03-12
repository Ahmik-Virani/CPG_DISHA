import jwt from "jsonwebtoken";
import { JWT_SECRET, PAYMENT_BANKS } from "./config.js";

export const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
export const normalizeRollNo = (rollNo) => String(rollNo || "").toUpperCase().replace(/\s+/g, "").trim();

export function normalizeBanks(banks) {
  if (!Array.isArray(banks)) {
    return [];
  }

  const allowed = new Set(PAYMENT_BANKS);
  const normalized = banks
    .map((bank) => String(bank || "").trim().toUpperCase())
    .filter((bank) => allowed.has(bank));

  return [...new Set(normalized)];
}

export function stripPassword(user) {
  const { _id, passwordHash, ...safeUser } = user;
  return safeUser;
}

export function signToken(user) {
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
