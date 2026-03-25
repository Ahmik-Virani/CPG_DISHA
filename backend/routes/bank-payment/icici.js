import crypto from "node:crypto";
import { findBankByDisplayName } from "../../db.js";
import {
  ICICI_HMAC_SECRET,
  ICICI_HMAC_ALGO,
  ICICI_INITIATE_SALE_URL,
  ICICI_AUTH_REDIRECT_URL,
  ICICI_STATUS_CHECK_URL,
} from "../../config.js";

function buildHttpError(status, message, details = {}) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function normalizeFieldKey(key) {
  return String(key || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getBankFieldValue(bankDoc, supportedKeys) {
  const fields = Array.isArray(bankDoc?.fields) ? bankDoc.fields : [];
  const normalizedKeys = new Set(supportedKeys.map((key) => normalizeFieldKey(key)));

  for (const field of fields) {
    const fieldKey = normalizeFieldKey(field?.key);
    if (!normalizedKeys.has(fieldKey)) {
      continue;
    }

    const value = String(field?.value || "").trim();
    if (value) {
      return value;
    }
  }

  return "";
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

export async function initiateIciciSale({ amount, returnURL, userEmail }) {
  if (!ICICI_HMAC_SECRET) {
    throw buildHttpError(500, "ICICI_HMAC_SECRET is not configured");
  }

  const amountNumber = Number(amount);
  if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
    throw buildHttpError(
      400,
      "A valid fixed amount is required before initiating payment for this request"
    );
  }

  const iciciBankDoc = await findBankByDisplayName("ICICI");
  const merchantId = getBankFieldValue(iciciBankDoc, ["merchantID", "merchantId", "ICICI_merchantId"]);
  const aggregatorID = getBankFieldValue(iciciBankDoc, ["aggregatorID", "aggregatorId"]);

  if (!merchantId || !aggregatorID) {
    throw buildHttpError(400, "ICICI bank configuration is missing merchantID or aggregatorID");
  }

  const packetWithoutHash = {
    amount: Number(amountNumber.toFixed(2)),
    currencyCode: 356,
    customerEmailID: userEmail,
    merchantId: String(merchantId),
    aggregatorID: String(aggregatorID),
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

  console.log("[ICICI initiateSale] requestPacket:\n" + JSON.stringify(requestPacket, null, 2));

  const initiateSaleResponse = await fetch(ICICI_INITIATE_SALE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(requestPacket),
  });

  const responsePacket = await initiateSaleResponse.json().catch(() => ({}));
  console.log("[ICICI initiateSale] responsePacket:\n" + JSON.stringify(responsePacket, null, 2));

  if (!initiateSaleResponse.ok) {
    throw buildHttpError(502, "Failed to initiate sale with ICICI", {
      upstreamStatus: initiateSaleResponse.status,
      responsePacket,
    });
  }

  const tranCtx = findTranCtx(responsePacket);
  if (!tranCtx) {
    throw buildHttpError(502, "ICICI response did not contain tranCtx", {
      responsePacket,
    });
  }

  const paymentURL = ICICI_AUTH_REDIRECT_URL + "?tranCtx=" + encodeURIComponent(tranCtx);

  return {
    paymentURL,
    tranCtx,
    requestPacket,
    responsePacket,
    statusCheckURL: ICICI_STATUS_CHECK_URL,
  };
}
