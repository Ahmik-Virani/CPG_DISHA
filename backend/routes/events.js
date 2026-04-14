import crypto from "node:crypto";
import { Router } from "express";
import {
  findUserById,
  createEventRecord,
  listEventsByIds,
  listEventsBySystemHeadId,
  findEventByIdForSystemHead,
  markEventDone,
  deleteEventById,
  listBanks,
  getAllPaymentRequestTypesByEventIds,
  listPaymentRequestIdsBySystemHead,
  listPaymentProcessedByPaymentRequestIds,
  listExternalPaymentProcessedBySystemHeadId,
  listPaymentRequestContextsByIds,
} from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/auth.js";

const router = Router();


function resolveRecordStatus(record) {
  const status = String(record?.status || "").trim().toLowerCase();
  if (status) {
    return status;
  }

  const txnStatus = String(record?.transaction?.status || record?.txnStatus || "").trim().toUpperCase();
  if (txnStatus === "SUC") {
    return "paid";
  }
  if (["REJ", "ERR"].includes(txnStatus)) {
    return "failed";
  }
  return "pending";
}

function buildSystemHeadHistory(records, requestContexts, events) {
  const contextByPaymentRequestId = new Map(
    requestContexts.map((context) => [String(context.paymentRequestId || "").trim(), context])
  );
  const eventById = new Map(events.map((event) => [String(event.id || "").trim(), event]));

  return records.map((record) => {
    const paymentRequestId = String(record.paymentRequestId || "").trim();
    const context = contextByPaymentRequestId.get(paymentRequestId);
    const event = eventById.get(String(context?.eventId || "").trim());

    return {
      id: record.id,
      paymentRequestId,
      eventId: context?.eventId || null,
      eventName: event?.name || "Unknown Event",
      eventDescription: event?.description || "No event description available",
      type: context?.type || null,
      status: resolveRecordStatus(record),
      student: record.student || null,
      transaction: record.transaction || null,
      bank: record.bank || null,
      createdAt: record.createdAt || null,
      updatedAt: record.updatedAt || null,
    };
  });
}

function buildExternalHistory(records) {
  return records.map((record) => ({
    id: record.id,
    paymentRequestId: null,
    eventId: null,
    eventName: "External",
    eventDescription: "External payment link",
    type: "external",
    status: resolveRecordStatus(record),
    student: record.student || null,
    transaction: record.transaction || null,
    bank: record.bank || null,
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
  }));
}


router.get("/banks/options", requireAuth, requireRole("system_head"), async (_req, res) => {
  const banks = await listBanks();
  const enabledBanks = banks.filter((bank) => (typeof bank.enabled === "boolean" ? bank.enabled : true));
  return res.json({
    banks: enabledBanks.map((bank) => ({
      id: bank.id,
      name: bank.displayName,
    })),
  });
});

router.get("/", requireAuth, requireRole("system_head"), async (req, res) => {
  const events = await listEventsBySystemHeadId(req.auth.sub);
  const typesByEventId = await getAllPaymentRequestTypesByEventIds(
    events.map((event) => event.id),
    req.auth.sub
  );

  const eventsWithPaymentTypes = events.map((event) => ({
    ...event,
    paymentRequestTypes: Array.from(typesByEventId.get(event.id) || new Set()),
  }));

  return res.json({ events: eventsWithPaymentTypes });
});

router.get("/transactions/history", requireAuth, requireRole("system_head"), async (req, res) => {
  const eventId = String(req.query?.eventId || "").trim();
  const paymentRequestIds = await listPaymentRequestIdsBySystemHead(req.auth.sub, eventId);
  const includeExternal = !eventId;

  const [externalRecords, records, requestContexts] = await Promise.all([
    includeExternal ? listExternalPaymentProcessedBySystemHeadId(req.auth.sub) : Promise.resolve([]),
    paymentRequestIds.length ? listPaymentProcessedByPaymentRequestIds(paymentRequestIds) : Promise.resolve([]),
    paymentRequestIds.length ? listPaymentRequestContextsByIds(paymentRequestIds) : Promise.resolve([]),
  ]);

  if (!records.length && !externalRecords.length) {
    return res.json({ transactions: [] });
  }

  const eventIds = [...new Set(requestContexts.map((context) => String(context.eventId || "").trim()).filter(Boolean))];
  const events = await listEventsByIds(eventIds);
  const history = [
    ...buildSystemHeadHistory(records, requestContexts, events),
    ...buildExternalHistory(externalRecords),
  ].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  return res.json({ transactions: history });
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
  console.log(`[Event] Created event ${event.id} - Name: "${name}", SystemID: ${req.auth.sub}`);

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

  // Log the deletion with associated resources
  const deletedTemplateIds = result.deletedTemplateIds || [];
  const deletedFixedCount = result.deletedFixedPaymentRequestCount || 0;
  const deletedOneTimeCount = result.deletedOneTimePaymentRequestCount || 0;
  const deletedRecurringCount = result.deletedRecurringTemplateCount || 0;
  
  console.log(
    `[Event] Deleted event ${req.params.eventId} - SystemID: ${req.auth.sub}, ` +
    `DeletedFixedPayments: ${deletedFixedCount}, DeletedOneTimePayments: ${deletedOneTimeCount}, ` +
    `DeletedRecurringTemplates: ${deletedRecurringCount}`
  );

  return res.json({ message: "Event deleted successfully" });
});

export default router;