import { Router } from "express";
import { getUsersCollection } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/system-heads", requireAuth, requireRole("admin"), async (_req, res) => {
  const users = await getUsersCollection()
    .find({ role: "system_head" }, { projection: { passwordHash: 0, _id: 0 } })
    .sort({ createdAt: -1 })
    .toArray();

  return res.json({ users });
});

export default router;
