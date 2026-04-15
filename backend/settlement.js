import crypto from "node:crypto";
import { findBankByDisplayName, listSettlementHistoryByBank, listSuccessfulIciciTransactionsBetween, upsertSettlementHistoryRecord } from "./db.js";
import { ICICI_HMAC_ALGO, ICICI_HMAC_SECRET, ICICI_SETTLEMENT_URL } from "./config.js";

const IST_OFFSET = "+05:30";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function buildSettlementError(message) {
  return new Error(`[Settlement] ${message}`);
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

async function getIciciMerchantConfig() {
  const iciciBankDoc = await findBankByDisplayName("ICICI");
  const merchantId = getBankFieldValue(iciciBankDoc, ["merchantID", "merchantId", "ICICI_merchantId"]);
  const aggregatorID = getBankFieldValue(iciciBankDoc, ["aggregatorID", "aggregatorId"]);

  if (!merchantId || !aggregatorID) {
    throw buildSettlementError("ICICI bank configuration is missing merchantID or aggregatorID");
  }

  return {
    merchantId: String(merchantId),
    aggregatorID: String(aggregatorID),
  };
}

function buildSecureHashFromSortedValues(packet) {
  const hashAlgorithm = (ICICI_HMAC_ALGO || "sha256").toLowerCase();
  if (!crypto.getHashes().includes(hashAlgorithm)) {
    throw buildSettlementError("ICICI_HMAC_ALGO is invalid");
  }

  const sortedKeys = Object.keys(packet).sort();
  const concatenatedValues = sortedKeys.map((key) => String(packet[key] ?? "")).join("");

  return crypto
    .createHmac(hashAlgorithm, ICICI_HMAC_SECRET)
    .update(concatenatedValues)
    .digest("hex");
}

function parseApiResponse(rawResponse) {
  try {
    return rawResponse ? JSON.parse(rawResponse) : {};
  } catch {
    return Object.fromEntries(new URLSearchParams(rawResponse));
  }
}

function normalizeSettlementPayouts(responsePacket) {
  const payoutsRaw = responsePacket?.Payouts ?? responsePacket?.payouts ?? [];

  if (Array.isArray(payoutsRaw)) {
    return payoutsRaw;
  }

  if (typeof payoutsRaw === "string") {
    try {
      const parsed = JSON.parse(payoutsRaw);
      return Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
    } catch {
      return [];
    }
  }

  if (payoutsRaw && typeof payoutsRaw === "object") {
    return [payoutsRaw];
  }

  return [];
}

function parseAmount(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 0;
  }
  return Number(num.toFixed(2));
}

function findResponseCode(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const keys = ["responseCode", "response_code", "respCode", "statusCode", "error_code"];
  for (const key of keys) {
    const value = payload[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  for (const value of Object.values(payload)) {
    if (value && typeof value === "object") {
      const nested = findResponseCode(value);
      if (nested) {
        return nested;
      }
    }
  }

  return "";
}

function findSettlementStatus(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const keys = ["settlementStatus", "settlementstatus"];
  for (const key of keys) {
    const value = payload[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  for (const value of Object.values(payload)) {
    if (value && typeof value === "object") {
      const nested = findSettlementStatus(value);
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

  const keys = ["txnStatus", "status", "transactionStatus"];
  for (const key of keys) {
    const value = payload[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
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

async function callSettlementCommand(packetWithoutHash) {
  if (!ICICI_HMAC_SECRET) {
    throw buildSettlementError("ICICI_HMAC_SECRET is not configured");
  }

  if (!ICICI_SETTLEMENT_URL) {
    throw buildSettlementError("ICICI_SETTLEMENT_URL is not configured");
  }

  const secureHash = buildSecureHashFromSortedValues(packetWithoutHash);
  const requestPacket = {
    ...packetWithoutHash,
    secureHash,
  };

  const body = new URLSearchParams();
  Object.entries(requestPacket).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      body.append(key, String(value));
    }
  });

  const response = await fetch(ICICI_SETTLEMENT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json, text/plain, */*",
    },
    body: body.toString(),
  });

  const rawResponse = await response.text();
  const responsePacket = parseApiResponse(rawResponse);

  if (!response.ok) {
    throw buildSettlementError(`Settlement API failed with status ${response.status}`);
  }

  return { requestPacket, responsePacket };
}

function formatSettlementDate(date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";
  return `${year}${month}${day}`;
}

function getPreviousIstSettlementDate() {
  return formatSettlementDate(new Date(Date.now() - MS_PER_DAY));
}

function buildIstDayRange(settlementDate) {
  const year = settlementDate.slice(0, 4);
  const month = settlementDate.slice(4, 6);
  const day = settlementDate.slice(6, 8);

  const startIso = new Date(`${year}-${month}-${day}T00:00:00${IST_OFFSET}`).toISOString();
  const endIso = new Date(`${year}-${month}-${day}T24:00:00${IST_OFFSET}`).toISOString();

  return { startIso, endIso };
}

async function fetchIciciSettlementSummary({ settlementDate }) {
  const normalizedSettlementDate = String(settlementDate || "").trim();
  if (!/^\d{8}$/.test(normalizedSettlementDate)) {
    throw buildSettlementError("settlementDate must be in YYYYMMDD format");
  }

  const { merchantId, aggregatorID } = await getIciciMerchantConfig();

  const { requestPacket, responsePacket } = await callSettlementCommand({
    merchantID: merchantId,
    aggregatorID,
    settlementDate: normalizedSettlementDate,
    transactionType: "SETTLEMENTSUMMARY",
  });

  const responseCode = findResponseCode(responsePacket);
  const isSuccess = responseCode === "000" || responseCode === "0000";
  const payouts = normalizeSettlementPayouts(responsePacket);

  const totalSettledAmount = Number(
    payouts.reduce((sum, payout) => sum + parseAmount(payout?.pay_amount ?? payout?.payAmount), 0).toFixed(2)
  );

  return {
    requestPacket,
    responsePacket,
    responseCode,
    isSuccess,
    payouts,
    totalSettledAmount,
  };
}

async function checkIciciSettlementStatus({ originalTxnNo }) {
  const normalizedOriginalTxnNo = String(originalTxnNo || "").trim();
  if (!normalizedOriginalTxnNo) {
    throw buildSettlementError("originalTxnNo is required");
  }

  const { merchantId, aggregatorID } = await getIciciMerchantConfig();
  const { requestPacket, responsePacket } = await callSettlementCommand({
    merchantID: merchantId,
    aggregatorID,
    originalTxnNo: normalizedOriginalTxnNo,
    transactionType: "SETTLSTATUS",
  });

  const responseCode = findResponseCode(responsePacket);
  const isSuccess = responseCode === "000" || responseCode === "0000";
  const settlementStatus = String(findSettlementStatus(responsePacket) || "").trim().toUpperCase();
  const txnStatus = String(findTxnStatus(responsePacket) || "").trim().toUpperCase();
  const settledAmount = parseAmount(responsePacket?.settledAmount ?? responsePacket?.txnAmount);

  return {
    requestPacket,
    responsePacket,
    responseCode,
    isSuccess,
    settlementStatus,
    txnStatus,
    settledAmount,
  };
}

async function syncBySummary(settlementDate) {
  const summary = await fetchIciciSettlementSummary({ settlementDate });
  if (!summary.isSuccess) {
    throw buildSettlementError(`Settlement summary failed with code ${summary.responseCode || "UNKNOWN"}`);
  }

  const record = await upsertSettlementHistoryRecord({
    bankName: "ICICI",
    settlementDate,
    updateFields: {
      status: "success",
      source: "summary",
      totalSettledAmount: parseAmount(summary.totalSettledAmount),
      transactionCount: Array.isArray(summary.payouts) ? summary.payouts.length : 0,
      payoutDetails: summary.payouts || [],
      responseCode: summary.responseCode || null,
      requestPacket: summary.requestPacket || null,
      responsePacket: summary.responsePacket || null,
      notes: "Settlement summary synced successfully",
    },
  });

  return {
    mode: "summary",
    record,
  };
}

async function syncByDateFallback(settlementDate, summaryErrorMessage = "") {
  const { startIso, endIso } = buildIstDayRange(settlementDate);
  const successfulTransactions = await listSuccessfulIciciTransactionsBetween(startIso, endIso);

  let totalSettledAmount = 0;
  let settledCount = 0;
  let checkedCount = 0;
  const settlementDetails = [];

  for (const txn of successfulTransactions) {
    const originalTxnNo = String(txn?.transaction?.transaction_id || "").trim();
    if (!originalTxnNo) {
      continue;
    }

    checkedCount += 1;

    try {
      const status = await checkIciciSettlementStatus({ originalTxnNo });
      const isSettled = status.isSuccess && status.settlementStatus === "STD" && status.txnStatus === "SUC";
      if (!isSettled) {
        settlementDetails.push({
          originalTxnNo,
          isSettled: false,
          responseCode: status.responseCode || null,
          settlementStatus: status.settlementStatus || null,
          txnStatus: status.txnStatus || null,
          settledAmount: parseAmount(status.settledAmount),
        });
        continue;
      }

      const settledAmount = parseAmount(status.settledAmount || txn?.transaction?.amount || 0);
      totalSettledAmount = Number((totalSettledAmount + settledAmount).toFixed(2));
      settledCount += 1;
      settlementDetails.push({
        originalTxnNo,
        isSettled: true,
        responseCode: status.responseCode || null,
        settlementStatus: status.settlementStatus || null,
        txnStatus: status.txnStatus || null,
        settledAmount,
      });
    } catch (error) {
      settlementDetails.push({
        originalTxnNo,
        isSettled: false,
        error: String(error?.message || error),
      });
    }
  }

  const record = await upsertSettlementHistoryRecord({
    bankName: "ICICI",
    settlementDate,
    updateFields: {
      status: settledCount > 0 ? "partial" : "failed",
      source: "status_fallback",
      totalSettledAmount,
      transactionCount: settledCount,
      checkedTransactionCount: checkedCount,
      settlementDetails,
      notes: summaryErrorMessage
        ? `Summary failed; fallback status checks used. ${summaryErrorMessage}`
        : "Fallback status checks used",
    },
  });

  return {
    mode: "status_fallback",
    record,
  };
}

export async function syncIciciSettlementHistoryForDate(settlementDate) {
  const normalizedDate = String(settlementDate || "").trim();
  if (!/^\d{8}$/.test(normalizedDate)) {
    throw buildSettlementError("settlementDate must be in YYYYMMDD format");
  }

  try {
    return await syncBySummary(normalizedDate);
  } catch (error) {
    const message = String(error?.message || error);
    console.warn(`[Settlement] Summary sync failed for ${normalizedDate}. Falling back to status checks.`, message);
    return syncByDateFallback(normalizedDate, message);
  }
}

export async function syncIciciSettlementHistoryForPreviousDay() {
  const settlementDate = getPreviousIstSettlementDate();
  return syncIciciSettlementHistoryForDate(settlementDate);
}

export async function getIciciSettlementHistory(limit = 30) {
  const records = await listSettlementHistoryByBank("ICICI", limit);
  const latest = records[0] || null;
  return { latest, records };
}
