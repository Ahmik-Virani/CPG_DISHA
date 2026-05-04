import crypto from "node:crypto";
import { Router } from "express";
import {
  findUserById,
  listOneTimePaymentRequestsByRollNo,
  listAllFixedPaymentRequests,
  listEventsByIds,
  findOneTimePaymentRequestById,
  findFixedPaymentRequestById,
  findBankByDisplayName,
  listPaymentProcessedByUserId,
  listPaymentRequestContextsByIds,
  createPaymentProcessedRecord,
  findPaymentProcessedById,
  updatePaymentProcessedById,
  updatePaymentRequestStatusById,
} from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { resolveStatusAfterHashVerification } from "../payment-status.js";
import { normalizeRollNo } from "../utils.js";
import { initiateIciciSale, checkIciciSaleStatus } from "./bank-payment/icici.js";

const router = Router();

function getEnabledBanks(request) {
  const fromArray = Array.isArray(request?.banks)
    ? request.banks.map((bank) => String(bank || "").trim()).filter(Boolean)
    : [];
  const fallback = String(request?.bank || "").trim();
  return [...new Set(fromArray.length ? fromArray : fallback ? [fallback] : [])];
}

function attachEventDetails(requests, events) {
  const detailsByEventId = new Map(
    events.map((event) => [
      event.id,
      {
        name: event.name || "Unnamed Event",
        description: event.description || "No event description available",
      },
    ])
  );

  return requests.map((request) => ({
    ...request,
    banks: getEnabledBanks(request),
    eventName: detailsByEventId.get(request.eventId)?.name || "Unknown Event",
    eventDescription:
      detailsByEventId.get(request.eventId)?.description || "No event description available",
  }));
}

function resolveRecordStatus(record) {
  const status = String(record?.status || "").trim().toLowerCase();
  if (["success", "failed", "pending"].includes(status)) {
    return status;
  }

  const txnStatus = String(record?.transaction?.status || record?.txnStatus || "").trim().toUpperCase();
  if (["SUC", "SUCCESS"].includes(txnStatus)) {
    return "success";
  }
  if (["REJ", "ERR", "FAILED", "FAIL"].includes(txnStatus)) {
    return "failed";
  }
  return "pending";
}

function buildUserHistoryView(records, requestContexts, events) {
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
      status: resolveRecordStatus(record),
      student: record.student || null,
      transaction: record.transaction || null,
      bank: record.bank || null,
      eventId: context?.eventId || null,
      eventName: event?.name || "Unknown Event",
      eventDescription: event?.description || "No event description available",
      type: context?.type || null,
      createdAt: record.createdAt || null,
      updatedAt: record.updatedAt || null,
    };
  });
}

function appendTrackingParams(urlInput, params) {
  try {
    const url = new URL(urlInput);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim()) {
        url.searchParams.set(key, String(value).trim());
      }
    });
    return url.toString();
  } catch {
    return urlInput;
  }
}

async function resolvePayableRequestForUser(paymentRequestId, user) {
  const oneTimeRequest = await findOneTimePaymentRequestById(paymentRequestId);
  if (oneTimeRequest) {
    const userRollNo = normalizeRollNo(user.roll_no);
    if (!userRollNo || normalizeRollNo(oneTimeRequest.rollNo) !== userRollNo) {
      return null;
    }
    return oneTimeRequest;
  }

  const fixedRequest = await findFixedPaymentRequestById(paymentRequestId);
  return fixedRequest || null;
}

export function createInitiateUserPaymentSaleHandler({
  findUserById: findUserByIdOverride = findUserById,
  findOneTimePaymentRequestById: findOneTimePaymentRequestByIdOverride = findOneTimePaymentRequestById,
  findFixedPaymentRequestById: findFixedPaymentRequestByIdOverride = findFixedPaymentRequestById,
  findBankByDisplayName: findBankByDisplayNameOverride = findBankByDisplayName,
  createPaymentProcessedRecord: createPaymentProcessedRecordOverride = createPaymentProcessedRecord,
  initiateIciciSale: initiateIciciSaleOverride = initiateIciciSale,
} = {}) {
  async function resolvePayableRequestForUserOverride(paymentRequestId, user) {
    const oneTimeRequest = await findOneTimePaymentRequestByIdOverride(paymentRequestId);
    if (oneTimeRequest) {
      const userRollNo = normalizeRollNo(user.roll_no);
      if (!userRollNo || normalizeRollNo(oneTimeRequest.rollNo) !== userRollNo) {
        return null;
      }
      return oneTimeRequest;
    }

    const fixedRequest = await findFixedPaymentRequestByIdOverride(paymentRequestId);
    return fixedRequest || null;
  }

  return async (req, res) => {
    const paymentRequestId = String(req.body?.paymentRequestId || "").trim();
    const returnURL = String(req.body?.returnURL || "").trim();
    const selectedBankInput = String(req.body?.bank || "").trim();
    const customAmount = req.body?.customAmount;

    if (!paymentRequestId) {
      return res.status(400).json({ message: "paymentRequestId is required" });
    }

    if (!returnURL) {
      return res.status(400).json({ message: "returnURL is required" });
    }

    const user = await findUserByIdOverride(req.auth.sub);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const paymentRequest = await resolvePayableRequestForUserOverride(paymentRequestId, user);
    if (!paymentRequest) {
      return res.status(404).json({ message: "Payment request not found" });
    }

    const enabledBanks = getEnabledBanks(paymentRequest);
    if (!enabledBanks.length) {
      return res.status(400).json({ message: "No banks are enabled for this payment request" });
    }

    const selectedBank = selectedBankInput || enabledBanks[0];
    const selectedBankMatch = enabledBanks.find(
      (bank) => bank.toLowerCase() === selectedBank.toLowerCase()
    );
    if (!selectedBankMatch) {
      return res.status(400).json({ message: "Selected bank is not enabled for this payment request" });
    }

    const selectedBankDoc = await findBankByDisplayNameOverride(selectedBankMatch);
    const isEnabled = typeof selectedBankDoc?.enabled === "boolean" ? selectedBankDoc.enabled : true;

    if (!isEnabled) {
      return res.status(400).json({ message: "Not available at the moment" });
    }

    if (selectedBankMatch.toLowerCase() !== "icici") {
      return res.status(400).json({ message: "Yet to be added" });
    }

    let finalAmount = paymentRequest.amount;
    const isVariableAmount = paymentRequest?.isAmountFixed === false;

    if (isVariableAmount) {
      if (customAmount === undefined || customAmount === null) {
        return res.status(400).json({ message: "Amount is required for variable payment requests" });
      }

      const parsedAmount = Number(customAmount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ message: "Please provide a valid positive amount" });
      }

      finalAmount = parsedAmount;
    }

    const paymentRecordId = crypto.randomUUID();
    const returnURLWithTracking = returnURL;

    try {
      const paymentGatewayResponse = await initiateIciciSaleOverride({
        amount: finalAmount,
        returnURL: returnURL,
        userEmail: user.email,
      });

      const now = new Date().toISOString();
      const paymentRecord = {
        id: paymentRecordId,
        status: "pending",
        student: {
          userId: user.id,
          roll_no: user.roll_no,
          name: user.name,
          email: user.email,
        },
        paymentRequestId,
        transaction: {
          transaction_id: paymentGatewayResponse?.requestPacket?.merchantTxnNo || null,
          merchant_id: paymentGatewayResponse?.requestPacket?.merchantId || null,
          response_code: "PENDING",
          amount: Number(Number(finalAmount).toFixed(2)),
          date: now,
        },
        bank: {
          bank_id: selectedBankDoc?.id || selectedBankMatch,
          bank_name: selectedBankDoc?.displayName || selectedBankMatch,
        },
        gateway: {
          tranCtx: paymentGatewayResponse?.tranCtx || null,
          requestPacket: paymentGatewayResponse?.requestPacket || null,
          responsePacket: paymentGatewayResponse?.responsePacket || null,
        },
        createdAt: now,
        updatedAt: now,
      };

      await createPaymentProcessedRecordOverride(paymentRecord);

      return res.json({
        ...paymentGatewayResponse,
        paymentRecordId,
        returnURL: returnURLWithTracking,
        status: "pending",
      });
    } catch (error) {
      if (error?.status) {
        return res.status(error.status).json({
          message: error.message || "Failed to initiate ICICI payment",
          ...(error?.details || {}),
        });
      }
      throw error;
    }
  };
}

export function createVerifyUserPaymentStatusHandler({
  findUserById: findUserByIdOverride = findUserById,
  findPaymentProcessedById: findPaymentProcessedByIdOverride = findPaymentProcessedById,
  listPaymentProcessedByUserId: listPaymentProcessedByUserIdOverride = listPaymentProcessedByUserId,
  updatePaymentProcessedById: updatePaymentProcessedByIdOverride = updatePaymentProcessedById,
  updatePaymentRequestStatusById: updatePaymentRequestStatusByIdOverride = updatePaymentRequestStatusById,
  checkIciciSaleStatus: checkIciciSaleStatusOverride = checkIciciSaleStatus,
} = {}) {
  return async (req, res) => {
    const paymentRecordId = String(req.body?.paymentRecordId || "").trim();
    const fallbackPaymentRequestId = String(req.body?.paymentRequestId || "").trim();
    const originalTxnNoInput = String(req.body?.originalTxnNo || req.body?.tranCtx || "").trim();

    if (!paymentRecordId && !fallbackPaymentRequestId) {
      return res.status(400).json({ message: "paymentRecordId or paymentRequestId is required" });
    }

    const user = await findUserByIdOverride(req.auth.sub);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let paymentRecord = null;
    if (paymentRecordId) {
      paymentRecord = await findPaymentProcessedByIdOverride(paymentRecordId);
    }

    if (!paymentRecord && fallbackPaymentRequestId) {
      const records = await listPaymentProcessedByUserIdOverride(user.id);
      paymentRecord = records.find((record) => String(record.paymentRequestId || "").trim() === fallbackPaymentRequestId) || null;
    }

    if (!paymentRecord) {
      return res.status(404).json({ message: "Payment record not found" });
    }

    if (String(paymentRecord?.student?.userId || "") !== String(user.id)) {
      return res.status(403).json({ message: "You are not allowed to verify this payment" });
    }

    if (String(paymentRecord.status || "").toLowerCase() === "success") {
      return res.json({
        status: "success",
        paymentRecord,
        message: "Payment is already marked as success",
      });
    }

    const merchantTxnNo = String(paymentRecord?.transaction?.transaction_id || "").trim();
    const originalTxnNo =
      originalTxnNoInput ||
      String(paymentRecord?.gateway?.originalTxnNo || "").trim() ||
      String(paymentRecord?.gateway?.tranCtx || "").trim() ||
      String(paymentRecord?.gateway?.responsePacket?.originalTxnNo || "").trim() ||
      String(paymentRecord?.gateway?.responsePacket?.tranCtx || "").trim() ||
      merchantTxnNo;

    try {
      const statusResult = await checkIciciSaleStatusOverride({
        merchantTxnNo,
        originalTxnNo,
      });
      const verificationDecision = resolveStatusAfterHashVerification(paymentRecord.status, statusResult);

      if (!verificationDecision.shouldPersistFinalStatus) {
        const updatedPaymentRecord = await updatePaymentProcessedByIdOverride(paymentRecord.id, {
          pendingHashVerificationRetry: verificationDecision.pendingHashVerificationRetry,
          gateway: {
            ...(paymentRecord.gateway || {}),
            tranCtx: paymentRecord?.gateway?.tranCtx || null,
            originalTxnNo,
            statusRequestPacket: statusResult.requestPacket,
            statusResponsePacket: statusResult.responsePacket,
          },
        });

        return res.json({
          status: verificationDecision.responseStatus,
          paymentRecord: updatedPaymentRecord || paymentRecord,
          message: "Payment status could not be verified. Will retry automatically.",
        });
      }

      const finalStatus = verificationDecision.persistedStatus;
      const dbStatusLabel = statusResult.dbStatusLabel || (finalStatus === "success" ? "SUCCESSFUL" : "FAILURE");

      const updatedPaymentRecord = await updatePaymentProcessedByIdOverride(paymentRecord.id, {
        status: finalStatus,
        pendingHashVerificationRetry: verificationDecision.pendingHashVerificationRetry,
        transaction: {
          ...(paymentRecord.transaction || {}),
          status: dbStatusLabel,
          response_code: dbStatusLabel,
          date: new Date().toISOString(),
        },
        gateway: {
          ...(paymentRecord.gateway || {}),
          tranCtx: paymentRecord?.gateway?.tranCtx || null,
          originalTxnNo,
          statusRequestPacket: statusResult.requestPacket,
          statusResponsePacket: statusResult.responsePacket,
          txnRespDescription: statusResult.txnRespDescription || null,
        },
      });

      await updatePaymentRequestStatusByIdOverride(paymentRecord.paymentRequestId, finalStatus);

      return res.json({
        status: finalStatus,
        paymentRecord: updatedPaymentRecord || paymentRecord,
        statusSignal: statusResult.statusSignal,
        txnRespDescription: statusResult.txnRespDescription || null,
      });
    } catch (error) {
      if (error?.status) {
        return res.status(error.status).json({
          message: error.message || "Failed to verify payment status",
          ...(error?.details || {}),
        });
      }
      throw error;
    }
  };
}

const verifyUserPaymentStatus = createVerifyUserPaymentStatusHandler();
const initiateUserPaymentSale = createInitiateUserPaymentSaleHandler();

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
  return res.json({ requests: attachEventDetails(requests, events) });
});

router.get("/optional", requireAuth, requireRole("user"), async (_req, res) => {
  const requests = await listAllFixedPaymentRequests();
  const events = await listEventsByIds(requests.map((request) => request.eventId));
  return res.json({ requests: attachEventDetails(requests, events) });
});

router.get("/history", requireAuth, requireRole("user"), async (req, res) => {
  const user = await findUserById(req.auth.sub);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const records = await listPaymentProcessedByUserId(user.id);
  const paymentRequestIds = records.map((record) => String(record.paymentRequestId || "").trim()).filter(Boolean);

  const requestContexts = await listPaymentRequestContextsByIds(paymentRequestIds);
  const eventIds = [...new Set(requestContexts.map((context) => String(context.eventId || "").trim()).filter(Boolean))];
  const events = await listEventsByIds(eventIds);

  return res.json({ transactions: buildUserHistoryView(records, requestContexts, events) });
});

router.post("/initiate-sale", requireAuth, requireRole("user"), initiateUserPaymentSale);

router.post("/verify-status", requireAuth, requireRole("user"), verifyUserPaymentStatus);

export default router;
