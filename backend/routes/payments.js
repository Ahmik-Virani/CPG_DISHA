import crypto from "node:crypto";
import { Router } from "express";
import { normalizeRollNo, normalizeBanks } from "../utils.js";
import {
  findEventByIdForSystemHead,
  createOneTimePaymentRequestRecord,
  createFixedPaymentRequestRecord,
} from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.post(
  "/:eventId/payment-requests",
  requireAuth,
  requireRole("system_head"),
  async (req, res) => {
    const eventId = String(req.params?.eventId || "").trim();
    const systemHeadId = req.auth.sub;
    const type = String(req.body?.type || "").trim().toLowerCase();
    const banks = normalizeBanks(req.body?.banks);

    const event = await findEventByIdForSystemHead(eventId, systemHeadId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (!["one_time", "fixed"].includes(type)) {
      return res.status(400).json({ message: "type must be one of one_time or fixed" });
    }

    if (!banks.length) {
      return res.status(400).json({ message: "banks must include at least one valid bank" });
    }

    if (type === "one_time") {
      const rollNo = normalizeRollNo(req.body?.rollNo);
      const amount = Number(req.body?.amount);
      const ttlRaw = String(req.body?.timeToLive || "").trim();
      const ttl = new Date(ttlRaw);

      if (!rollNo || !Number.isFinite(amount) || amount <= 0 || !ttlRaw || Number.isNaN(ttl.getTime())) {
        return res.status(400).json({
          message: "rollNo, amount, and timeToLive are required for one_time requests",
        });
      }

      const now = new Date().toISOString();
      const paymentRequest = {
        id: crypto.randomUUID(),
        createdBySystemHeadId: systemHeadId,
        eventId,
        type: "one_time",
        rollNo,
        banks,
        amount,
        status: "pending",
        timeToLive: ttl.toISOString(),
        createdAt: now,
        updatedAt: now,
      };

      await createOneTimePaymentRequestRecord(paymentRequest);
      return res.status(201).json({ paymentRequest, table: "One_Time_Payment_Request" });
    }

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
      banks,
      isAmountFixed,
      amount: isAmountFixed ? amount : null,
      createdAt: now,
      updatedAt: now,
    };

    await createFixedPaymentRequestRecord(paymentRequest);
    return res.status(201).json({ paymentRequest, table: "Fixed_Payment_Request" });
  }
);

export default router;
