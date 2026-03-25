import jwt from "jsonwebtoken";
import { JWT_SECRET } from "./config.js";

export const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
export const normalizeRollNo = (rollNo) => String(rollNo || "").toUpperCase().replace(/\s+/g, "").trim();

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
