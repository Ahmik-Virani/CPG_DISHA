import jwt from "jsonwebtoken";
import { JWT_SECRET, PAYMENT_BANKS } from "./config.js";

export const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
export const normalizeRollNo = (rollNo) => String(rollNo || "").toUpperCase().replace(/\s+/g, "").trim();

export function normalizeBank(bankInput) {
  const bank = String(bankInput || "").trim().toUpperCase();
  return PAYMENT_BANKS.includes(bank) ? bank : "";
}

export function normalizeBanks(banks) {
  if (Array.isArray(banks)) {
    const normalized = banks
      .map((bank) => normalizeBank(bank))
      .filter(Boolean);

    return [...new Set(normalized)];
  }

  const normalized = normalizeBank(banks);
  return normalized ? [normalized] : [];
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
    { expiresIn: "15m" }
  );
}
