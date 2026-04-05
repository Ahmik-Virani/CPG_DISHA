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
  return buildSecureHashFromConcatenatedValues(concatenatedValues);
}

function buildSecureHashFromOrderedValues(values) {
  const concatenatedValues = values.map((value) => String(value ?? "")).join("");
  return buildSecureHashFromConcatenatedValues(concatenatedValues);
}

function buildSecureHashFromConcatenatedValues(concatenatedValues) {
  const hashAlgorithm = (ICICI_HMAC_ALGO || "sha256").toLowerCase();

  if (!crypto.getHashes().includes(hashAlgorithm)) {
    throw buildHttpError(500, "ICICI_HMAC_ALGO is invalid", {
      hashAlgorithm,
    });
  }

  return crypto
    .createHmac(hashAlgorithm, ICICI_HMAC_SECRET)
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

function findTxnStatus(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const keys = ["status", "txnStatus", "transactionStatus", "responseCode", "response_code"];
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  for (const value of Object.values(payload)) {
    if (value && typeof value === "object") {
      const nested = findTxnStatus(value);
      if (nested) {
        return nested;
      }
    }
  }

  return "";
}

function findTxnRespDescription(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const keys = ["txnRespDescription", "txnResponseDescription", "responseDescription"];
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  for (const value of Object.values(payload)) {
    if (value && typeof value === "object") {
      const nested = findTxnRespDescription(value);
      if (nested) {
        return nested;
      }
    }
  }

  return "";
}

async function getIciciMerchantConfig() {
  const iciciBankDoc = await findBankByDisplayName("ICICI");
  const merchantId = getBankFieldValue(iciciBankDoc, ["merchantID", "merchantId", "ICICI_merchantId"]);
  const aggregatorID = getBankFieldValue(iciciBankDoc, ["aggregatorID", "aggregatorId"]);

  if (!merchantId || !aggregatorID) {
    throw buildHttpError(400, "ICICI bank configuration is missing merchantID or aggregatorID");
  }

  return {
    merchantId: String(merchantId),
    aggregatorID: String(aggregatorID),
  };
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

  const { merchantId, aggregatorID } = await getIciciMerchantConfig();

  const packetWithoutHash = {
    amount: Number(amountNumber.toFixed(2)),
    currencyCode: 356,
    customerEmailID: userEmail,
    merchantId,
    aggregatorID,
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
  console.log("[ICICI initiateSale] verifying response secureHash...");
  verifyResponseSecureHash(responsePacket);

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

export async function checkIciciSaleStatus({
  tranCtx,
  merchantTxnNo,
  originalTxnNo,
  amount,
  userEmail,
}) {
  if (!ICICI_HMAC_SECRET) {
    throw buildHttpError(500, "ICICI_HMAC_SECRET is not configured");
  }

  if (!ICICI_STATUS_CHECK_URL) {
    throw buildHttpError(500, "ICICI_STATUS_CHECK_URL is not configured");
  }

  if (!tranCtx && !merchantTxnNo) {
    throw buildHttpError(400, "Either tranCtx or merchantTxnNo is required to check ICICI status");
  }

  const { merchantId, aggregatorID } = await getIciciMerchantConfig();

  const normalizedMerchantTxnNo = String(merchantTxnNo || "").trim();
  const resolvedOriginalTxnNo = String(originalTxnNo || "").trim() || normalizedMerchantTxnNo;

  const packetWithoutHash = {
    merchantId,
    aggregatorID,
    transactionType: "STATUS",
  };

  if (normalizedMerchantTxnNo) {
    packetWithoutHash.merchantTxnNo = normalizedMerchantTxnNo;
    packetWithoutHash.originalTxnNo = normalizedMerchantTxnNo;
  }

  if (tranCtx) {
    packetWithoutHash.tranCtx = String(tranCtx).trim();
  }

  if (Number.isFinite(Number(amount))) {
    packetWithoutHash.amount = Number(Number(amount).toFixed(2));
  }

  if (userEmail) {
    packetWithoutHash.customerEmailID = String(userEmail).trim();
  }

  // ICICI STATUS secureHash: sort keys alphabetically, concatenate values, then HMAC.
  const secureHash = buildSecureHashFromSortedValues(packetWithoutHash);
  const requestPacket = {
    ...packetWithoutHash,
    secureHash,
  };

  console.log("[ICICI statusCheck] requestPacket:\n" + JSON.stringify(requestPacket, null, 2));

  const statusCheckResponse = await fetch(ICICI_STATUS_CHECK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(requestPacket),
  });

  const rawResponse = await statusCheckResponse.text();
  let responsePacket = {};
  try {
    responsePacket = rawResponse ? JSON.parse(rawResponse) : {};
  } catch {
    responsePacket = Object.fromEntries(new URLSearchParams(rawResponse));
  }

  console.log("[ICICI statusCheck] responsePacket:\n" + JSON.stringify(responsePacket, null, 2));

  if (!statusCheckResponse.ok) {
    throw buildHttpError(502, "Failed to check status with ICICI", {
      upstreamStatus: statusCheckResponse.status,
      responsePacket,
    });
  }

  const statusSignal = findTxnStatus(responsePacket);
  const txnRespDescription = findTxnRespDescription(responsePacket);
  const isSuccessful = txnRespDescription.toLowerCase() === "transaction successful";
  const hashVerified = verifyResponseSecureHash(responsePacket);

  return {
    hashVerified,
    status: isSuccessful ? "success" : "failed",
    dbStatusLabel: isSuccessful ? "SUCCESSFUL" : "FAILURE",
    statusSignal,
    txnRespDescription,
    requestPacket,
    responsePacket,
  };
}

function verifyResponseSecureHash(responsePacket) {
  const receivedHash = String(responsePacket?.secureHash || "").trim();
  if (!receivedHash) {
    console.log("[ICICI hashVerify] No secureHash in response — treating as tampered");
    return false;
  }

  // oth_charge is appended by ICICI after the hash is computed (bank-side charge),
  // so it must be excluded from hash verification.
  const POST_HASH_FIELDS = new Set(["secureHash", "oth_charge"]);
  const rest = Object.fromEntries(
    Object.entries(responsePacket).filter(([k]) => !POST_HASH_FIELDS.has(k))
  );

  // ICICI V1: sort keys alphabetically (case-sensitive), concatenate non-null values
  const sortedKeys = Object.keys(rest).sort();
  const sortedValues = sortedKeys.map((k) => String(rest[k] ?? "")).join("");
  const hashSorted = buildSecureHashFromConcatenatedValues(sortedValues);

  // Fallback: sorted, also skip boolean false / empty string values
  const hashSortedSkipFalsy = buildSecureHashFromConcatenatedValues(
    sortedKeys.filter((k) => rest[k] !== null && rest[k] !== "" && rest[k] !== false && rest[k] !== undefined)
      .map((k) => String(rest[k])).join("")
  );

  // Fallback: JSON insertion order (in case ICICI uses response order)
  const insertionValues = Object.values(rest).map((v) => String(v ?? "")).join("");
  const hashInsertion = buildSecureHashFromConcatenatedValues(insertionValues);

  console.log(`[ICICI hashVerify] received     = ${receivedHash}`);
  console.log(`[ICICI hashVerify] hash (sorted)= ${hashSorted}  match=${hashSorted === receivedHash}`);

  const attempts = [
    ["sorted", hashSorted],
    ["sorted/skip-falsy", hashSortedSkipFalsy],
    ["insertion", hashInsertion],
  ];

  for (const [label, hash] of attempts) {
    if (hash.length === receivedHash.length &&
      crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(receivedHash, "hex"))) {
      console.log(`[ICICI hashVerify] VERIFIED via ${label}`);
      return true;
    }
  }

  console.log(`[ICICI hashVerify] FAILED — keys used: ${sortedKeys.join(",")}`);
  console.log(`[ICICI hashVerify] concat: ${sortedValues}`);
  return false;
}
