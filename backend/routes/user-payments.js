import { Router } from "express";
import { findUserById, listOneTimePaymentRequestsByRollNo, listAllFixedPaymentRequests, listEventsByIds } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { normalizeRollNo } from "../utils.js";

const router = Router();

function attachEventNames(requests, events) {
  const namesByEventId = new Map(events.map((event) => [event.id, event.name || "Unnamed Event"]));
  return requests.map((request) => ({
    ...request,
    eventName: namesByEventId.get(request.eventId) || "Unknown Event",
  }));
}


router.get("/pending", requireAuth, requireRole("user"), async (req, res) => {
  const userId = req.auth.sub;
  const user = await findUserById(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const rollNo = normalizeRollNo(user.roll_no);
  if (!rollNo) {
    return res.status(400).json({ message: "No roll number associated with this account" });
  }

  const requests = await listOneTimePaymentRequestsByRollNo(rollNo);
  const events = await listEventsByIds(requests.map((request) => request.eventId));
  return res.json({ requests: attachEventNames(requests, events) });
});

router.get("/optional", requireAuth, requireRole("user"), async (_req, res) => {
  const requests = await listAllFixedPaymentRequests();
  const events = await listEventsByIds(requests.map((request) => request.eventId));
  return res.json({ requests: attachEventNames(requests, events) });
});

export default router;
