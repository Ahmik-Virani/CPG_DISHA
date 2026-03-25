import { Router } from "express";
import {
  findUserById,
  listOneTimePaymentRequestsByRollNo,
  listAllFixedPaymentRequests,
  listEventsByIds,
  findOneTimePaymentRequestById,
  findFixedPaymentRequestById,
} from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { normalizeRollNo } from "../utils.js";
import { initiateIciciSale } from "./bank-payment/icici.js";

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

router.post("/initiate-sale", requireAuth, requireRole("user"), async (req, res) => {
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

  const user = await findUserById(req.auth.sub);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const paymentRequest = await resolvePayableRequestForUser(paymentRequestId, user);
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

  if (selectedBankMatch.toLowerCase() !== "icici") {
    return res.status(400).json({ message: "Not available at the moment" });
  }

  // Validate and use custom amount for variable payments
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

  try {
    const paymentGatewayResponse = await initiateIciciSale({
      amount: finalAmount,
      returnURL,
      userEmail: user.email,
    });
    return res.json(paymentGatewayResponse);
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({
        message: error.message || "Failed to initiate ICICI payment",
        ...(error?.details || {}),
      });
    }
    throw error;
  }
});

export default router;
