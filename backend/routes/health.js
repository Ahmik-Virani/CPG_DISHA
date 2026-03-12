import { Router } from "express";
import { isMongoReady, getUsersCollection } from "../db.js";

const router = Router();

router.get("/", async (_req, res) => {
  if (!isMongoReady()) {
    return res.status(503).json({
      ok: false,
      db: "disconnected",
      message: "Backend is running, waiting for MongoDB connection",
    });
  }

  const users = await getUsersCollection().countDocuments();
  return res.json({ ok: true, users, db: "connected" });
});

export default router;
