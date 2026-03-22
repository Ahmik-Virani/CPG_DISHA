import crypto from "node:crypto";
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
import {
  ICICI_HMAC_SECRET,
  ICICI_HMAC_ALGO,
  ICICI_INITIATE_SALE_URL,
  ICICI_AUTH_REDIRECT_URL,
  ICICI_STATUS_CHECK_URL,
} from "../config.js";

const router = Router();

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
    eventName: detailsByEventId.get(request.eventId)?.name || "Unknown Event",
    eventDescription:
      detailsByEventId.get(request.eventId)?.description || "No event description available",
  }));
}

function formatTxnDate(date = new Date()) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return year + month + day + hours + minutes + seconds;
}

function generateMerchantTxnNo() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let output = "";
  while (output.length < 20) {
    output += chars[crypto.randomInt(0, chars.length)];
  }
  return output;
}

function buildSecureHashFromSortedValues(packet) {
  const sortedKeys = Object.keys(packet).sort();
  const concatenatedValues = sortedKeys.map((key) => String(packet[key] ?? "")).join("");

  return crypto
    .createHmac(ICICI_HMAC_ALGO || "sha256", ICICI_HMAC_SECRET)
    .update(concatenatedValues)
    .digest("hex");
}

function findTranCtx(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  if (typeof payload.tranCtx === "string" && payload.tranCtx.trim()) {
    return payload.tranCtx.trim();
  }

  if (typeof payload.tranctx === "string" && payload.tranctx.trim()) {
    return payload.tranctx.trim();
  }

  for (const value of Object.values(payload)) {
    if (value && typeof value === "object") {
      const nested = findTranCtx(value);
      if (nested) {
        return nested;
      }
    }
  }

  return "";
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

  if (!paymentRequestId) {
    return res.status(400).json({ message: "paymentRequestId is required" });
  }

  if (!returnURL) {
    return res.status(400).json({ message: "returnURL is required" });
  }

  if (!ICICI_HMAC_SECRET) {
    return res.status(500).json({ message: "ICICI_HMAC_SECRET is not configured" });
  }

  const user = await findUserById(req.auth.sub);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const paymentRequest = await resolvePayableRequestForUser(paymentRequestId, user);
  if (!paymentRequest) {
    return res.status(404).json({ message: "Payment request not found" });
  }

  const amount = Number(paymentRequest.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({
      message: "A valid fixed amount is required before initiating payment for this request",
    });
  }

  const systemHead = await findUserById(paymentRequest.createdBySystemHeadId);
  if (!systemHead?.ICICI_merchantId) {
    return res.status(400).json({
      message: "System head merchant configuration is missing for this payment request",
    });
  }

  const packetWithoutHash = {
    amount: Number(amount.toFixed(2)),
    currencyCode: 356,
    customerEmailID: user.email,
    merchantId: String(systemHead.ICICI_merchantId),
    merchantTxnNo: generateMerchantTxnNo(),
    payType: 0,
    returnURL,
    transactionType: "SALE",
    txnDate: formatTxnDate(),
  };

  const secureHash = buildSecureHashFromSortedValues(packetWithoutHash);
  const requestPacket = {
    ...packetWithoutHash,
    secureHash,
  };

  const initiateSaleResponse = await fetch(ICICI_INITIATE_SALE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(requestPacket),
  });

  const responsePacket = await initiateSaleResponse.json().catch(() => ({}));
  if (!initiateSaleResponse.ok) {
    return res.status(502).json({
      message: "Failed to initiate sale with ICICI",
      upstreamStatus: initiateSaleResponse.status,
      responsePacket,
    });
  }

  const tranCtx = findTranCtx(responsePacket);
  if (!tranCtx) {
    return res.status(502).json({
      message: "ICICI response did not contain tranCtx",
      responsePacket,
    });
  }

  const paymentURL = ICICI_AUTH_REDIRECT_URL + "?tranCtx=" + encodeURIComponent(tranCtx);

  return res.json({
    paymentURL,
    tranCtx,
    requestPacket,
    responsePacket,
    statusCheckURL: ICICI_STATUS_CHECK_URL,
  });
});

export default router;
