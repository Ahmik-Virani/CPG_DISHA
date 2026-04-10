import crypto from "node:crypto";
import { Router } from "express";
import { normalizeRollNo } from "../utils.js";
import {
  findEventByIdForSystemHead,
  createOneTimePaymentRequestRecords,
  createFixedPaymentRequestRecord,
  createRecurringTemplateRecord,
  findLatestPaymentRequestByEventAndSystemHead,
  findUserById,
  listOneTimePaymentRequestsByBatchId,
  listBanks,
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

    if (!["one_time", "fixed"].includes(type)) {
      return res.status(400).json({ message: "type must be one of one_time or fixed" });
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

      // Check if this one-time payment should be marked as recurring
      const isRecurring = req.body?.isRecurring === true;
      let recurringTemplate = null;

      if (isRecurring) {
        // Validate recurring options
        const intervalValue = Number(req.body?.intervalValue);
        const intervalUnit = String(req.body?.intervalUnit || "").trim().toLowerCase();

        if (!Number.isFinite(intervalValue) || intervalValue <= 0) {
          return res.status(400).json({
            message: "intervalValue must be a positive number for recurring one-time payments",
          });
        }

        if (!["days", "months"].includes(intervalUnit)) {
          return res.status(400).json({
            message: "intervalUnit must be either 'days' or 'months' for recurring one-time payments",
          });
        }

        // Calculate next execution date
        const nextExecutionDate = calculateNextExecutionDate(new Date(), intervalValue, intervalUnit).toISOString();

        // Create recurring template with all necessary data
        recurringTemplate = {
          id: crypto.randomUUID(),
          eventId,
          createdBySystemHeadId: systemHeadId,
          entries: entries.map(e => ({ rollNo: e.rollNo, amount: e.amount })),
          bank: banks[0],
          banks,
          originalTimeToLive: ttl.toISOString(),
          originalCreationDate: now,
          intervalValue,
          intervalUnit,
          status: "active",
          nextExecutionDate,
          createdAt: now,
          updatedAt: now,
          lastGeneratedAt: null,
          lastGeneratedPaymentIds: [],
        };

        await createRecurringTemplateRecord(recurringTemplate);
        console.log(
          `[Create Payment] Created recurring template ${recurringTemplate.id} for one-time payment ` +
          `(Event: ${eventId}, Interval: ${intervalValue} ${intervalUnit})`
        );
      }

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
        recurringTemplate: recurringTemplate ? { id: recurringTemplate.id } : null,
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