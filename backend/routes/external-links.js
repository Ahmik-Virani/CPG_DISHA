import crypto from "node:crypto";
import { Router } from "express";
import {
  bumpExternalLinkUsage,
  createOrGetExternalLinkForSystemHead,
  createPaymentProcessedRecord,
  findExternalPaymentProcessedByMerchantTxnNo,
  findExternalPaymentProcessedByTranCtx,
  findExternalLinkById,
  findPaymentProcessedById,
  findUserById,
  listBanks,
  updateExternalLinkById,
  updatePaymentProcessedById,
} from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { checkIciciSaleStatus, initiateIciciSale } from "./bank-payment/icici.js";

const router = Router();

function normalizeAmount(input) {
  const value = Number(input);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Number(value.toFixed(2));
}

function normalizeEmail(input) {
  const value = String(input || "").trim().toLowerCase();
  if (!value) {
    return "";
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value) ? value : "";
}

function buildPaymentPath(linkId, amount) {
  const query = new URLSearchParams({
    amount: Number(amount).toFixed(2),
  });
  return `/pay/external/${encodeURIComponent(linkId)}?${query.toString()}`;
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

async function findEnabledBanksByName() {
  const banks = await listBanks();
  const enabledBanks = banks.filter((bank) => (typeof bank.enabled === "boolean" ? bank.enabled : true));
  return enabledBanks.map((bank) => String(bank.displayName || "").trim()).filter(Boolean);
}

async function getActiveExternalLink(linkId) {
  const link = await findExternalLinkById(linkId);
  if (!link) {
    return { link: null, message: "External link not found", status: 404 };
  }

  if (String(link.status || "active") !== "active") {
    return { link: null, message: "External link is disabled", status: 410 };
  }

  return { link, message: "", status: 200 };
}

function normalizeExternalStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (["success", "failed", "pending"].includes(normalized)) {
    return normalized;
  }

  const txnStatus = String(status || "").trim().toUpperCase();
  if (["SUC", "SUCCESS", "SUCCESSFUL"].includes(txnStatus)) {
    return "success";
  }
  if (["REJ", "ERR", "FAILED", "FAIL", "FAILURE"].includes(txnStatus)) {
    return "failed";
  }
  return "pending";
}

function buildExternalReceiptView(paymentRecord, systemHead) {
  return {
    id: paymentRecord.id,
    paymentRecordId: paymentRecord.id,
    paymentRequestId: null,
    source: "external_link",
    type: "external",
    status: normalizeExternalStatus(paymentRecord.status),
    eventName: "External Payment",
    eventDescription: systemHead?.name
      ? `Payment received for ${systemHead.name}`
      : "Payment received via external payment link",
    student: paymentRecord.student || null,
    transaction: paymentRecord.transaction || null,
    bank: paymentRecord.bank || null,
    createdAt: paymentRecord.createdAt || null,
    updatedAt: paymentRecord.updatedAt || null,
    systemHead: {
      id: paymentRecord.createdBySystemHeadId || null,
      name: systemHead?.name || "System Head",
      email: systemHead?.email || null,
    },
  };
}

router.post("/me", requireAuth, requireRole("system_head"), async (req, res) => {
  const systemHeadId = req.auth.sub;
  const link = await createOrGetExternalLinkForSystemHead(systemHeadId);
  return res.json({
    link: {
      id: link.id,
      status: link.status || "active",
      usageCount: Number(link.usageCount || 0),
      lastUsedAt: link.lastUsedAt || null,
    },
  });
});

router.post("/me/payment-url", requireAuth, requireRole("system_head"), async (req, res) => {
  const amount = normalizeAmount(req.body?.amount);
  if (amount === null) {
    return res.status(400).json({ message: "amount must be a positive number" });
  }

  const systemHeadId = req.auth.sub;
  const link = await createOrGetExternalLinkForSystemHead(systemHeadId);
  const paymentPath = buildPaymentPath(link.id, amount);

  return res.json({
    linkId: link.id,
    amount,
    paymentPath,
  });
});

router.patch("/:linkId/status", requireAuth, requireRole("system_head"), async (req, res) => {
  const linkId = String(req.params?.linkId || "").trim();
  const status = String(req.body?.status || "").trim().toLowerCase();
  if (!linkId) {
    return res.status(400).json({ message: "linkId is required" });
  }

  if (!["active", "disabled"].includes(status)) {
    return res.status(400).json({ message: "status must be either active or disabled" });
  }

  const link = await findExternalLinkById(linkId);
  if (!link || String(link.createdBySystemHeadId || "") !== String(req.auth.sub || "")) {
    return res.status(404).json({ message: "External link not found" });
  }

  const updated = await updateExternalLinkById(linkId, { status });
  return res.json({
    link: {
      id: updated.id,
      status: updated.status,
      usageCount: Number(updated.usageCount || 0),
      lastUsedAt: updated.lastUsedAt || null,
    },
  });
});

router.get("/:linkId/resolve", async (req, res) => {
  const linkId = String(req.params?.linkId || "").trim();
  const amountRaw = req.query?.amount;

  if (!linkId) {
    return res.status(400).json({ message: "linkId is required" });
  }

  const { link, message, status } = await getActiveExternalLink(linkId);
  if (!link) {
    return res.status(status).json({ message });
  }

  const amount = normalizeAmount(amountRaw);
  if (amount === null) {
    return res.status(400).json({ message: "amount is required" });
  }

  const [systemHead, banks] = await Promise.all([
    findUserById(link.createdBySystemHeadId),
    findEnabledBanksByName(),
  ]);

  return res.json({
    linkId,
    amount,
    systemHead: {
      id: link.createdBySystemHeadId,
      name: systemHead?.name || "System Head",
      email: systemHead?.email || null,
    },
    banks,
  });
});

router.post("/:linkId/initiate", async (req, res) => {
  const linkId = String(req.params?.linkId || "").trim();
  const amountRaw = req.body?.amount;
  const email = normalizeEmail(req.body?.email);
  const selectedBankInput = String(req.body?.bank || "").trim();
  const returnURLInput = String(req.body?.returnURL || "").trim();

  if (!linkId) {
    return res.status(400).json({ message: "linkId is required" });
  }

  if (!email) {
    return res.status(400).json({ message: "A valid email is required" });
  }

  if (!selectedBankInput) {
    return res.status(400).json({ message: "bank is required" });
  }

  if (!returnURLInput) {
    return res.status(400).json({ message: "returnURL is required" });
  }

  const { link, message, status } = await getActiveExternalLink(linkId);
  if (!link) {
    return res.status(status).json({ message });
  }

  const amount = normalizeAmount(amountRaw);
  if (amount === null) {
    return res.status(400).json({ message: "amount is required" });
  }

  const enabledBanks = await findEnabledBanksByName();
  const selectedBank = enabledBanks.find(
    (bankName) => bankName.toLowerCase() === selectedBankInput.toLowerCase()
  );

  if (!selectedBank) {
    return res.status(400).json({ message: "Selected bank is not currently enabled" });
  }

  if (selectedBank.toLowerCase() !== "icici") {
    return res.status(400).json({ message: "Yet to be added" });
  }

  const paymentRecordId = crypto.randomUUID();
  const returnURLWithTracking = appendTrackingParams(returnURLInput, {
    paymentRecordId,
    linkId,
    amount: Number(amount).toFixed(2),
  });

  try {
    const paymentGatewayResponse = await initiateIciciSale({
      amount,
      returnURL: returnURLWithTracking,
      userEmail: email,
    });

    const now = new Date().toISOString();
    await createPaymentProcessedRecord({
      id: paymentRecordId,
      status: "pending",
      source: "external_link",
      createdBySystemHeadId: link.createdBySystemHeadId,
      externalLinkId: linkId,
      paymentRequestId: null,
      student: {
        userId: null,
        roll_no: "External",
        name: "External",
        email,
      },
      transaction: {
        transaction_id: paymentGatewayResponse?.requestPacket?.merchantTxnNo || null,
        merchant_id: paymentGatewayResponse?.requestPacket?.merchantId || null,
        response_code: "PENDING",
        amount: Number(Number(amount).toFixed(2)),
        date: now,
      },
      bank: {
        bank_id: selectedBank,
        bank_name: selectedBank,
      },
      gateway: {
        tranCtx: paymentGatewayResponse?.tranCtx || null,
        requestPacket: paymentGatewayResponse?.requestPacket || null,
        responsePacket: paymentGatewayResponse?.responsePacket || null,
      },
      createdAt: now,
      updatedAt: now,
    });

    await bumpExternalLinkUsage(linkId);

    return res.json({
      ...paymentGatewayResponse,
      paymentRecordId,
      status: "pending",
      returnURL: returnURLWithTracking,
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
});

router.get("/receipt/:paymentRecordId", async (req, res) => {
  const paymentRecordId = String(req.params?.paymentRecordId || "").trim();
  if (!paymentRecordId) {
    return res.status(400).json({ message: "paymentRecordId is required" });
  }

  const paymentRecord = await findPaymentProcessedById(paymentRecordId);
  if (!paymentRecord || String(paymentRecord?.source || "") !== "external_link") {
    return res.status(404).json({ message: "External receipt not found" });
  }

  if (normalizeExternalStatus(paymentRecord.status) !== "success") {
    return res.status(409).json({ message: "Payment is not verified as successful yet" });
  }

  const systemHead = await findUserById(paymentRecord.createdBySystemHeadId);
  return res.json({ receipt: buildExternalReceiptView(paymentRecord, systemHead) });
});

router.post("/verify-status", async (req, res) => {
  const paymentRecordId = String(req.body?.paymentRecordId || "").trim();
  const merchantTxnNoInput = String(req.body?.merchantTxnNo || req.body?.merchantTxnno || "").trim();
  const tranCtxInput = String(req.body?.tranCtx || req.body?.tranctx || "").trim();
  const originalTxnNoInput = String(req.body?.originalTxnNo || tranCtxInput || "").trim();

  console.log(
    "[External verify-status] Incoming request:",
    JSON.stringify(
      {
        paymentRecordId,
        merchantTxnNoInput,
        originalTxnNoInput,
        tranCtxInput,
      },
      null,
      2
    )
  );

  if (!paymentRecordId && !merchantTxnNoInput && !tranCtxInput) {
    return res.status(400).json({ message: "paymentRecordId or merchantTxnNo or tranCtx is required" });
  }

  let paymentRecord = null;
  if (paymentRecordId) {
    paymentRecord = await findPaymentProcessedById(paymentRecordId);
  }
  if (!paymentRecord && merchantTxnNoInput) {
    paymentRecord = await findExternalPaymentProcessedByMerchantTxnNo(merchantTxnNoInput);
  }
  if (!paymentRecord && tranCtxInput) {
    paymentRecord = await findExternalPaymentProcessedByTranCtx(tranCtxInput);
  }

  if (!paymentRecord || String(paymentRecord?.source || "") !== "external_link") {
    console.log("[External verify-status] Payment record not found for provided identifiers");
    return res.status(404).json({ message: "External payment record not found" });
  }

  if (String(paymentRecord.status || "").toLowerCase() === "success") {
    console.log(`[External verify-status] Payment ${paymentRecord.id} already successful. Skipping ICICI call.`);
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

  console.log(
    "[External verify-status] Calling ICICI status check with:",
    JSON.stringify(
      {
        paymentRecordId: paymentRecord.id,
        merchantTxnNo,
        originalTxnNo,
      },
      null,
      2
    )
  );

  try {
    const statusResult = await checkIciciSaleStatus({
      merchantTxnNo,
      originalTxnNo,
    });

    console.log(
      "[External verify-status] ICICI status check result:",
      JSON.stringify(
        {
          paymentRecordId: paymentRecord.id,
          hashVerified: statusResult.hashVerified,
          status: statusResult.status,
          dbStatusLabel: statusResult.dbStatusLabel,
          txnRespDescription: statusResult.txnRespDescription,
          statusSignal: statusResult.statusSignal,
        },
        null,
        2
      )
    );

    if (!statusResult.hashVerified) {
      const updatedPaymentRecord = await updatePaymentProcessedById(paymentRecord.id, {
        pendingHashVerificationRetry: true,
        gateway: {
          ...(paymentRecord.gateway || {}),
          tranCtx: paymentRecord?.gateway?.tranCtx || null,
          originalTxnNo,
          statusRequestPacket: statusResult.requestPacket,
          statusResponsePacket: statusResult.responsePacket,
        },
      });

      return res.json({
        status: "pending",
        paymentRecord: updatedPaymentRecord || paymentRecord,
        message: "Payment status could not be verified. Will retry automatically.",
      });
    }

    const finalStatus = statusResult.status;
    const dbStatusLabel = statusResult.dbStatusLabel || (finalStatus === "success" ? "SUCCESSFUL" : "FAILURE");

    const updatedPaymentRecord = await updatePaymentProcessedById(paymentRecord.id, {
      status: finalStatus,
      pendingHashVerificationRetry: false,
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

    return res.json({
      status: finalStatus,
      paymentRecord: updatedPaymentRecord || paymentRecord,
      statusSignal: statusResult.statusSignal,
      txnRespDescription: statusResult.txnRespDescription || null,
    });
  } catch (error) {
    console.error("[External verify-status] Error during ICICI status check:", error?.message || error);
    if (error?.status) {
      return res.status(error.status).json({
        message: error.message || "Failed to verify payment status",
        ...(error?.details || {}),
      });
    }
    throw error;
  }
});

export default router;
