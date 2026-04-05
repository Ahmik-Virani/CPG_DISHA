import crypto from "node:crypto";
import { Router } from "express";
import { normalizeRollNo } from "../utils.js";
import {
  findEventByIdForSystemHead,
  createEventRecord,
  createOneTimePaymentRequestRecords,
  createFixedPaymentRequestRecord,
  createRecurringPaymentRequestRecord,
  findLatestPaymentRequestByEventAndSystemHead,
  findUserById,
  listOneTimePaymentRequestsByBatchId,
  listBanks,
  updateRecurringEventInstanceCounter,
  markEventAsRecurringTemplate,
} from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

function normalizeOneTimeEntries(entriesInput) {
  if (!Array.isArray(entriesInput)) {
    return [];
  }

  return entriesInput
    .map((entry) => {
      const rollNo = normalizeRollNo(entry?.rollNo);
      const amount = Number(entry?.amount);
      return {
        rollNo,
        amount,
      };
    })
    .filter((entry) => entry.rollNo && Number.isFinite(entry.amount) && entry.amount > 0);
}

function hasDuplicateRollNos(entries) {
  const unique = new Set();
  for (const entry of entries) {
    const key = String(entry.rollNo || "").trim();
    if (!key) {
      continue;
    }

    if (unique.has(key)) {
      return true;
    }

    unique.add(key);
  }

  return false;
}

async function resolveEnabledBanks(inputBank, inputBanks) {
  const candidates = [
    String(inputBank || "").trim(),
    ...(Array.isArray(inputBanks) ? inputBanks.map((entry) => String(entry || "").trim()) : []),
  ].filter(Boolean);

  if (!candidates.length) {
    return [];
  }

  const banks = await listBanks();
  const enabledBanks = banks.filter((bank) => (typeof bank.enabled === "boolean" ? bank.enabled : true));
  const byId = new Map();
  const byName = new Map();

  enabledBanks.forEach((bank) => {
    byId.set(String(bank.id || "").trim(), bank.displayName);
    byName.set(String(bank.normalizedDisplayName || "").trim(), bank.displayName);
  });

  const enabled = [];
  for (const candidate of candidates) {
    const byIdValue = byId.get(candidate);
    if (byIdValue) {
      enabled.push(byIdValue);
      continue;
    }

    const byNameValue = byName.get(candidate.toLowerCase());
    if (byNameValue) {
      enabled.push(byNameValue);
    }
  }

  return [...new Set(enabled)];
}

async function buildLatestPaymentRequestView(paymentRequest, systemHeadId) {
  if (!paymentRequest) {
    return null;
  }

  if (paymentRequest.type !== "one_time" || !paymentRequest.batchId) {
    return paymentRequest;
  }

  const batchRequests = await listOneTimePaymentRequestsByBatchId(paymentRequest.batchId, systemHeadId);
  return {
    ...paymentRequest,
    entries: batchRequests.map((request) => ({
      rollNo: request.rollNo,
      amount: request.amount,
    })),
  };
}

router.get(
  "/:eventId/payment-requests/latest",
  requireAuth,
  requireRole("system_head"),
  async (req, res) => {
    const eventId = String(req.params?.eventId || "").trim();
    const systemHeadId = req.auth.sub;

    const event = await findEventByIdForSystemHead(eventId, systemHeadId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const paymentRequest = await findLatestPaymentRequestByEventAndSystemHead(eventId, systemHeadId);
    const paymentRequestView = await buildLatestPaymentRequestView(paymentRequest, systemHeadId);
    return res.json({ paymentRequest: paymentRequestView || null });
  }
);

router.post(
  "/:eventId/payment-requests",
  requireAuth,
  requireRole("system_head"),
  async (req, res) => {
    const eventId = String(req.params?.eventId || "").trim();
    const systemHeadId = req.auth.sub;
    const type = String(req.body?.type || "").trim().toLowerCase();
    const banks = await resolveEnabledBanks(req.body?.bank, req.body?.banks);

    const event = await findEventByIdForSystemHead(eventId, systemHeadId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const existingRequest = await findLatestPaymentRequestByEventAndSystemHead(eventId, systemHeadId);
    if (existingRequest) {
      return res.status(409).json({
        message: "Payment request already exists for this event",
        paymentRequest: existingRequest,
      });
    }

    if (!["one_time", "fixed", "recurring"].includes(type)) {
      return res.status(400).json({ message: "type must be one of one_time, fixed, or recurring" });
    }

    if (!banks.length) {
      return res.status(400).json({ message: "At least one valid bank option must be selected" });
    }

    if (type === "one_time") {
      const entries = normalizeOneTimeEntries(req.body?.entries);
      const ttlRaw = String(req.body?.timeToLive || "").trim();
      const ttl = new Date(ttlRaw);

      if (!entries.length || !ttlRaw || Number.isNaN(ttl.getTime())) {
        return res.status(400).json({
          message: "At least one valid rollNo and amount pair with timeToLive is required for one_time requests",
        });
      }

      if (hasDuplicateRollNos(entries)) {
        return res.status(400).json({
          message: "Duplicate roll numbers are not allowed in one_time requests",
        });
      }

      const now = new Date().toISOString();
      const batchId = crypto.randomUUID();
      const paymentRequests = entries.map((entry) => ({
        id: crypto.randomUUID(),
        batchId,
        createdBySystemHeadId: systemHeadId,
        eventId,
        type: "one_time",
        rollNo: entry.rollNo,
        bank: banks[0],
        banks,
        amount: entry.amount,
        status: "pending",
        timeToLive: ttl.toISOString(),
        createdAt: now,
        updatedAt: now,
      }));

      await createOneTimePaymentRequestRecords(paymentRequests);
      return res.status(201).json({
        paymentRequests,
        paymentRequest: {
          ...paymentRequests[0],
          entries: paymentRequests.map((request) => ({
            rollNo: request.rollNo,
            amount: request.amount,
          })),
        },
        table: "One_Time_Payment_Request",
      });
    }

    if (type === "fixed") {
      const isAmountFixed = req.body?.isAmountFixed;
      if (typeof isAmountFixed !== "boolean") {
        return res.status(400).json({ message: "isAmountFixed must be a boolean for fixed requests" });
      }

      const amount = Number(req.body?.amount);
      if (isAmountFixed && (!Number.isFinite(amount) || amount <= 0)) {
        return res.status(400).json({ message: "amount must be greater than 0 when isAmountFixed is true" });
      }

      const now = new Date().toISOString();
      const paymentRequest = {
        id: crypto.randomUUID(),
        createdBySystemHeadId: systemHeadId,
        eventId,
        type: "fixed",
        bank: banks[0],
        banks,
        isAmountFixed,
        amount: isAmountFixed ? amount : null,
        createdAt: now,
        updatedAt: now,
      };

      await createFixedPaymentRequestRecord(paymentRequest);
      return res.status(201).json({ paymentRequest, table: "Fixed_Payment_Request" });
    }

    if (type === "recurring") {
      const isAmountFixed = req.body?.isAmountFixed;
      if (isAmountFixed !== true) {
        return res.status(400).json({ message: "Recurring payments must have isAmountFixed set to true" });
      }

      const amount = Number(req.body?.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ message: "amount must be greater than 0 for recurring requests" });
      }

      const recurringMode = String(req.body?.recurringMode || "").trim().toLowerCase();
      if (!["date", "interval"].includes(recurringMode)) {
        return res.status(400).json({ message: "recurringMode must be either 'date' or 'interval'" });
      }

      let nextExecutionDate = null;
      let intervalValue = null;
      let intervalUnit = null;

      if (recurringMode === "date") {
        const nextDateRaw = String(req.body?.nextExecutionDate || "").trim();
        const nextDate = new Date(nextDateRaw);

        if (!nextDateRaw || Number.isNaN(nextDate.getTime())) {
          return res.status(400).json({
            message: "nextExecutionDate is required and must be a valid date when recurringMode is 'date'",
          });
        }

        if (req.body?.intervalValue !== null && req.body?.intervalValue !== undefined) {
          return res.status(400).json({
            message: "intervalValue should not be provided when recurringMode is 'date'",
          });
        }
        if (req.body?.intervalUnit !== null && req.body?.intervalUnit !== undefined) {
          return res.status(400).json({
            message: "intervalUnit should not be provided when recurringMode is 'date'",
          });
        }

        nextExecutionDate = nextDate.toISOString();
      } else if (recurringMode === "interval") {
        intervalValue = Number(req.body?.intervalValue);
        intervalUnit = String(req.body?.intervalUnit || "").trim().toLowerCase();

        if (!Number.isFinite(intervalValue) || intervalValue <= 0) {
          return res.status(400).json({
            message: "intervalValue must be a positive number when recurringMode is 'interval'",
          });
        }

        if (!["days", "months"].includes(intervalUnit)) {
          return res.status(400).json({
            message: "intervalUnit must be either 'days' or 'months' when recurringMode is 'interval'",
          });
        }

        if (req.body?.nextExecutionDate !== null && req.body?.nextExecutionDate !== undefined) {
          return res.status(400).json({
            message: "nextExecutionDate should not be provided when recurringMode is 'interval'",
          });
        }

        nextExecutionDate = calculateNextExecutionDate(new Date(), intervalValue, intervalUnit).toISOString();
      }

      const now = new Date().toISOString();
      
      const paymentRequest = {
        id: crypto.randomUUID(),
        createdBySystemHeadId: systemHeadId,
        eventId,
        type: "recurring",
        recurringMode,
        nextExecutionDate,
        intervalValue,
        intervalUnit,
        bank: banks[0],
        banks,
        amount,
        status: "active",
        lastExecutedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      await createRecurringPaymentRequestRecord(paymentRequest);

      await markEventAsRecurringTemplate(eventId);

      const systemHead = await findUserById(systemHeadId);
      const instanceNumber = 1;
      const instanceEventName = `${event.name} #${instanceNumber}`;
      
      const instanceEvent = {
        id: crypto.randomUUID(),
        name: instanceEventName,
        description: event.description,
        createdBySystemHeadId: systemHeadId,
        createdBySystemHeadName: systemHead?.name || "",
        isOngoing: true,
        type: "fixed",
        templateEventId: eventId, 
        instanceNumber: instanceNumber,
        createdAt: now,
        updatedAt: now,
      };

      await createEventRecord(instanceEvent);

      const instantFixedPaymentRequest = {
        id: crypto.randomUUID(),
        createdBySystemHeadId: systemHeadId,
        eventId: instanceEvent.id, 
        type: "fixed",
        bank: banks[0],
        banks,
        isAmountFixed: true,
        amount,
        createdAt: now,
        updatedAt: now,
      };

      await createFixedPaymentRequestRecord(instantFixedPaymentRequest);
      
      console.log(`[Create Payment] Created recurring template event ${eventId}, instance #${instanceNumber} event ${instanceEvent.id}`);

      return res.status(201).json({ 
        paymentRequest, 
        table: "Recurring_Payment_Request", 
        templateEventId: eventId,
        instanceEventId: instanceEvent.id,
        instanceNumber: instanceNumber,
      });
    }
  }
);

function calculateNextExecutionDate(baseDate, value, unit) {
  const nextDate = new Date(baseDate);
  if (unit === "days") {
    nextDate.setDate(nextDate.getDate() + value);
  } else if (unit === "months") {
    nextDate.setMonth(nextDate.getMonth() + value);
  }
  return nextDate;
}

export default router;
