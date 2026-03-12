import crypto from "node:crypto";
import { Router } from "express";
import {
  findUserById,
  createEventRecord,
  listEventsBySystemHeadId,
  findEventByIdForSystemHead,
  markEventDone,
  deleteEventById,
} from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, requireRole("system_head"), async (req, res) => {
  const events = await listEventsBySystemHeadId(req.auth.sub);
  return res.json({ events });
});

router.get("/:eventId", requireAuth, requireRole("system_head"), async (req, res) => {
  const event = await findEventByIdForSystemHead(req.params.eventId, req.auth.sub);

  if (!event) {
    return res.status(404).json({ message: "Event not found" });
  }

  return res.json({ event });
});

router.post("/", requireAuth, requireRole("system_head"), async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const description = String(req.body?.description || "").trim();

  if (!name || !description) {
    return res.status(400).json({ message: "Event name and description are required" });
  }

  const systemHead = await findUserById(req.auth.sub);
  if (!systemHead) {
    return res.status(404).json({ message: "System head not found" });
  }

  const event = {
    id: crypto.randomUUID(),
    name,
    description,
    createdBySystemHeadId: req.auth.sub,
    createdBySystemHeadName: systemHead.name,
    isOngoing: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await createEventRecord(event);

  return res.status(201).json({ event });
});

router.patch("/:eventId/complete", requireAuth, requireRole("system_head"), async (req, res) => {
  const event = await markEventDone(req.params.eventId, req.auth.sub);

  if (!event) {
    return res.status(404).json({ message: "Event not found" });
  }

  return res.json({ event });
});

router.delete("/:eventId", requireAuth, requireRole("system_head"), async (req, res) => {
  const result = await deleteEventById(req.params.eventId, req.auth.sub);

  if (!result.deletedCount) {
    return res.status(404).json({ message: "Event not found" });
  }

  return res.json({ message: "Event deleted successfully" });
});

export default router;
