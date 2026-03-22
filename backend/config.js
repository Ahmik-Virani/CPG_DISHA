import dotenv from "dotenv";

dotenv.config();

export const PORT = Number(process.env.PORT || 4000);
export const JWT_SECRET = process.env.JWT_SECRET || "dev-jwt-secret-change-me";
export const MONGODB_CONNECTION_STRING = String(process.env.MONGODB_CONNECTION_STRING || "").trim();
export const MONGODB_USER_ID = String(
  process.env.MONGODB_USER_ID || process.env.MONGODO_USER_ID || ""
).trim();
export const MONGODB_PWD = String(process.env.MONGODB_PWD || "").trim();
export const MONGODB_DB_NAME = String(process.env.MONGODB_DB_NAME || "cpg_disha").trim();
export const ROLES = ["admin", "user", "system_head"];
export const SELF_SIGNUP_ROLES = ["user", "system_head"];
export const SALT_ROUNDS = 10;
export const PAYMENT_BANKS = ["ICICI", "SBI", "HDFC"];
