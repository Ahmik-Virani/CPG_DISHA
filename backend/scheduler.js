import crypto from "node:crypto";
import cron from "node-cron";
import {
  listRecurringTemplatesForExecution,
  updateRecurringTemplateById,
  createOneTimePaymentRequestRecords,
  findEventByIdForSystemHead,
  listPendingHashVerificationRetries,
  updatePaymentProcessedById,
  updatePaymentRequestStatusById,
  listPaymentProcessedForReconciliation,
  listPaymentRequestContextsByIds,
  listPaymentRequestIdsByEventId,
  listPaymentProcessedByPaymentRequestIds,
  findRefundByPaymentRecordId,
  createRefundRecord,
  updateRefundRecordById,
} from "./db.js";
import { checkIciciSaleStatus, initiateIciciRefund } from "./routes/bank-payment/icici.js";
import { syncIciciSettlementHistoryForPreviousDay } from "./settlement.js";

const MAX_PENDING_DAILY_RETRIES = 5;
const FAILED_RECHECK_DAYS = 2;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Calculate next execution date based on interval
 */
function calculateNextExecutionDate(currentDate, intervalValue, intervalUnit) {
  const nextDate = new Date(currentDate);
  if (intervalUnit === "days") {
    nextDate.setDate(nextDate.getDate() + intervalValue);
  } else if (intervalUnit === "months") {
    nextDate.setMonth(nextDate.getMonth() + intervalValue);
  }
  return nextDate;
}

function normalizeStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (["success", "failed", "pending"].includes(normalized)) {
    return normalized;
  }
  return "pending";
}

function normalizeRollNo(input) {
  return String(input || "").toUpperCase().replace(/\s+/g, "").trim();
}

function appendAlert(paymentRecord, reason, message) {
  const existingAlerts = Array.isArray(paymentRecord?.alerts) ? paymentRecord.alerts : [];
  return [
    ...existingAlerts,
    {
      id: crypto.randomUUID(),
      reason,
      message,
      createdAt: new Date().toISOString(),
      read: false,
    },
  ];
}

function computeUpdatedReconciliation(paymentRecord, patch = {}) {
  const reconciliation = paymentRecord?.reconciliation || {};
  return {
    pendingStatusChecks: Number(reconciliation.pendingStatusChecks || 0),
    failedStatusChecks: Number(reconciliation.failedStatusChecks || 0),
    firstFailedAt: reconciliation.firstFailedAt || null,
    lastCheckedAt: new Date().toISOString(),
    ...patch,
  };
}

function getTransitionKey(fromStatus, toStatus) {
  return `${fromStatus}->${toStatus}`;
}

async function processDuplicateRefundIfNeeded(paymentRecord, context) {
  const eventId = String(context?.eventId || "").trim();
  const rollNo = normalizeRollNo(paymentRecord?.student?.roll_no);

  if (!eventId || !rollNo) {
    return { refunded: false, reason: "missing-event-or-roll" };
  }

  const eventPaymentRequestIds = await listPaymentRequestIdsByEventId(eventId);
  if (!eventPaymentRequestIds.length) {
    return { refunded: false, reason: "no-payment-requests-for-event" };
  }

  const allEventPayments = await listPaymentProcessedByPaymentRequestIds(eventPaymentRequestIds);
  const successfulForRoll = allEventPayments
    .filter((record) => normalizeStatus(record?.status) === "success")
    .filter((record) => normalizeRollNo(record?.student?.roll_no) === rollNo)
    .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());

  if (successfulForRoll.length < 2) {
    return { refunded: false, reason: "no-duplicate-success" };
  }

  // Refund the payment that just turned successful when it is a duplicate.
  const hasAnotherSuccess = successfulForRoll.some((record) => String(record.id || "") !== String(paymentRecord.id || ""));
  if (!hasAnotherSuccess) {
    return { refunded: false, reason: "no-secondary-success-record" };
  }

  const existingRefund = await findRefundByPaymentRecordId(paymentRecord.id);
  if (existingRefund && ["initiated", "success"].includes(String(existingRefund.status || "").toLowerCase())) {
    return { refunded: false, reason: "refund-already-exists", refund: existingRefund };
  }

  const originalTxnNo = String(paymentRecord?.transaction?.transaction_id || "").trim();
  const amount = Number(paymentRecord?.transaction?.amount || 0);

  if (!originalTxnNo || !Number.isFinite(amount) || amount <= 0) {
    return { refunded: false, reason: "invalid-transaction-data-for-refund" };
  }

  const now = new Date().toISOString();
  const refundRecord = {
    id: crypto.randomUUID(),
    paymentRecordId: paymentRecord.id,
    paymentRequestId: paymentRecord.paymentRequestId || null,
    eventId,
    rollNo,
    originalTxnNo,
    amount: Number(amount.toFixed(2)),
    status: "initiated",
    trigger: "duplicate_successful_payment",
    requestPacket: null,
    responsePacket: null,
    responseCode: null,
    respDescription: null,
    hashVerified: null,
    createdAt: now,
    updatedAt: now,
  };

  await createRefundRecord(refundRecord);

  try {
    const refundResult = await initiateIciciRefund({
      originalTxnNo,
      amount,
      addlParam1: `${eventId}|${rollNo}`.slice(0, 64),
      addlParam2: String(paymentRecord.id || "").slice(0, 64),
    });

    const updatedRefund = await updateRefundRecordById(refundRecord.id, {
      status: refundResult.status === "success" && refundResult.hashVerified ? "success" : "failed",
      refundTxnNo: refundResult.merchantTxnNo || null,
      requestPacket: refundResult.requestPacket || null,
      responsePacket: refundResult.responsePacket || null,
      responseCode: refundResult.responseCode || null,
      respDescription: refundResult.respDescription || null,
      hashVerified: refundResult.hashVerified,
    });

    return {
      refunded: String(updatedRefund?.status || "") === "success",
      reason: String(updatedRefund?.status || "") === "success" ? "refund-success" : "refund-failed",
      refund: updatedRefund || refundRecord,
    };
  } catch (error) {
    await updateRefundRecordById(refundRecord.id, {
      status: "failed",
      respDescription: String(error?.message || "Refund API call failed").slice(0, 250),
    });

    return {
      refunded: false,
      reason: "refund-api-error",
      error: String(error?.message || error),
    };
  }
}

async function reconcileSinglePaymentRecord(paymentRecord, contextByPaymentRequestId) {
  const currentStatus = normalizeStatus(paymentRecord?.status);
  if (!["pending", "failed"].includes(currentStatus)) {
    return;
  }

  const reconciliation = paymentRecord?.reconciliation || {};
  const failedStatusChecks = Number(reconciliation.failedStatusChecks || 0);
  const nowMs = Date.now();
  const failureAnchor = reconciliation.firstFailedAt || paymentRecord.updatedAt || paymentRecord.createdAt || null;
  const daysSinceFailure = failureAnchor
    ? Math.floor((nowMs - new Date(failureAnchor).getTime()) / MS_PER_DAY)
    : 0;

  if (currentStatus === "failed" && (failedStatusChecks >= FAILED_RECHECK_DAYS || daysSinceFailure > FAILED_RECHECK_DAYS)) {
    return;
  }

  const merchantTxnNo = String(paymentRecord?.transaction?.transaction_id || "").trim();
  const tranCtx = String(paymentRecord?.gateway?.tranCtx || "").trim();
  const originalTxnNo =
    String(paymentRecord?.gateway?.originalTxnNo || "").trim() ||
    String(paymentRecord?.gateway?.responsePacket?.originalTxnNo || "").trim() ||
    tranCtx ||
    merchantTxnNo;

  if (!merchantTxnNo && !tranCtx) {
    return;
  }

  let statusResult = null;
  try {
    statusResult = await checkIciciSaleStatus({
      merchantTxnNo,
      tranCtx,
      originalTxnNo,
    });
  } catch (error) {
    console.error(`[Scheduler] Reconciliation status check failed for ${paymentRecord.id}:`, error?.message || error);
    return;
  }

  const effectiveStatus = statusResult.hashVerified ? normalizeStatus(statusResult.status) : currentStatus;
  const transition = getTransitionKey(currentStatus, effectiveStatus);
  const context = contextByPaymentRequestId.get(String(paymentRecord?.paymentRequestId || "").trim()) || null;

  const baseUpdate = {
    pendingHashVerificationRetry: !statusResult.hashVerified,
    gateway: {
      ...(paymentRecord.gateway || {}),
      tranCtx: paymentRecord?.gateway?.tranCtx || null,
      originalTxnNo,
      statusRequestPacket: statusResult.requestPacket,
      statusResponsePacket: statusResult.responsePacket,
      txnRespDescription: statusResult.txnRespDescription || null,
    },
  };

  if (effectiveStatus === "pending") {
    const pendingChecks = Number(reconciliation.pendingStatusChecks || 0) + 1;
    const pendingExceeded = pendingChecks >= MAX_PENDING_DAILY_RETRIES;

    if (pendingExceeded) {
      const alerts = appendAlert(
        paymentRecord,
        "pending-timeout",
        "Payment is still pending after 5 daily retries. Marked as failed."
      );

      await updatePaymentProcessedById(paymentRecord.id, {
        ...baseUpdate,
        status: "failed",
        alerts,
        transaction: {
          ...(paymentRecord.transaction || {}),
          status: "FAILURE",
          response_code: "FAILURE",
          date: new Date().toISOString(),
        },
        reconciliation: computeUpdatedReconciliation(paymentRecord, {
          pendingStatusChecks: pendingChecks,
          failedStatusChecks: 0,
          firstFailedAt: new Date().toISOString(),
        }),
      });

      if (paymentRecord.paymentRequestId) {
        await updatePaymentRequestStatusById(paymentRecord.paymentRequestId, "failed");
      }
      return;
    }

    await updatePaymentProcessedById(paymentRecord.id, {
      ...baseUpdate,
      status: currentStatus,
      reconciliation: computeUpdatedReconciliation(paymentRecord, {
        pendingStatusChecks: pendingChecks,
        failedStatusChecks: currentStatus === "failed" ? failedStatusChecks + 1 : Number(reconciliation.failedStatusChecks || 0),
        firstFailedAt: currentStatus === "failed" ? (reconciliation.firstFailedAt || new Date().toISOString()) : reconciliation.firstFailedAt || null,
      }),
    });

    if (transition === "failed->pending" && paymentRecord.paymentRequestId) {
      await updatePaymentRequestStatusById(paymentRecord.paymentRequestId, "pending");
    }

    return;
  }

  if (effectiveStatus === "failed") {
    await updatePaymentProcessedById(paymentRecord.id, {
      ...baseUpdate,
      status: "failed",
      transaction: {
        ...(paymentRecord.transaction || {}),
        status: "FAILURE",
        response_code: "FAILURE",
        date: new Date().toISOString(),
      },
      reconciliation: computeUpdatedReconciliation(paymentRecord, {
        pendingStatusChecks: 0,
        failedStatusChecks: currentStatus === "failed" ? failedStatusChecks + 1 : 0,
        firstFailedAt: currentStatus === "failed"
          ? (reconciliation.firstFailedAt || new Date().toISOString())
          : new Date().toISOString(),
      }),
    });

    if (paymentRecord.paymentRequestId) {
      await updatePaymentRequestStatusById(paymentRecord.paymentRequestId, "failed");
    }
    return;
  }

  if (effectiveStatus === "success") {
    let alerts = Array.isArray(paymentRecord.alerts) ? paymentRecord.alerts : [];

    if (transition === "failed->success") {
      alerts = appendAlert(
        paymentRecord,
        "failed-to-success",
        "Payment moved from failed to success. Please check your latest status."
      );
    }

    const duplicateRefundResult = await processDuplicateRefundIfNeeded(paymentRecord, context);

    if (duplicateRefundResult.refunded) {
      alerts = [
        ...alerts,
        {
          id: crypto.randomUUID(),
          reason: "duplicate-refund-processed",
          message: "Duplicate payment detected. Refund initiated successfully.",
          createdAt: new Date().toISOString(),
          read: false,
        },
      ];
    }

    await updatePaymentProcessedById(paymentRecord.id, {
      ...baseUpdate,
      status: "success",
      alerts,
      transaction: {
        ...(paymentRecord.transaction || {}),
        status: "SUCCESSFUL",
        response_code: "SUCCESSFUL",
        date: new Date().toISOString(),
      },
      reconciliation: computeUpdatedReconciliation(paymentRecord, {
        pendingStatusChecks: 0,
        failedStatusChecks: 0,
        firstFailedAt: null,
      }),
      duplicateRefund: duplicateRefundResult,
    });

    if (paymentRecord.paymentRequestId) {
      await updatePaymentRequestStatusById(paymentRecord.paymentRequestId, "success");
    }
  }
}

/**
 * Execute recurring templates to generate new one-time payments
 */
export async function executeRecurringTemplates() {
  try {
    const templates = await listRecurringTemplatesForExecution();

    if (!templates.length) {
      console.log("[Scheduler] No recurring templates to execute");
      return;
    }

    console.log(`[Scheduler] Processing ${templates.length} recurring templates`);

    for (const template of templates) {
      await processRecurringTemplate(template);
    }

    console.log("[Scheduler] Recurring templates execution completed");
  } catch (error) {
    console.error("[Scheduler] Error executing recurring templates:", error);
  }
}

/**
 * Process a single recurring template to generate new one-time payments
 */
async function processRecurringTemplate(template) {
  try {
    const {
      id: templateId,
      eventId,
      createdBySystemHeadId,
      entries,
      bank,
      banks,
      originalTimeToLive,
      originalCreationDate,
      intervalValue,
      intervalUnit,
    } = template;

    // Verify the event still exists
    const event = await findEventByIdForSystemHead(eventId, createdBySystemHeadId);
    if (!event) {
      console.log(`[Scheduler] Event ${eventId} not found for template ${templateId}. Deactivating template.`);
      await updateRecurringTemplateById(templateId, { status: "inactive" });
      return;
    }

    const now = new Date();
    const nowISO = now.toISOString();
    const originalCreation = new Date(originalCreationDate);
    const originalTTL = new Date(originalTimeToLive);
    const duration = originalTTL.getTime() - originalCreation.getTime();
    const newTimeToLive = new Date(now.getTime() + duration);
    const paymentRequests = entries.map((entry) => ({
      id: crypto.randomUUID(),
      batchId: crypto.randomUUID(),
      createdBySystemHeadId,
      eventId,
      type: "one_time",
      rollNo: entry.rollNo,
      bank,
      banks,
      amount: entry.amount,
      status: "pending",
      timeToLive: newTimeToLive.toISOString(),
      createdAt: nowISO,
      updatedAt: nowISO,
    }));

    await createOneTimePaymentRequestRecords(paymentRequests);

    const generatedPaymentIds = paymentRequests.map((p) => p.id);

    const nextExecutionDate = calculateNextExecutionDate(now, intervalValue, intervalUnit).toISOString();

    await updateRecurringTemplateById(templateId, {
      nextExecutionDate,
      lastGeneratedAt: nowISO,
      lastGeneratedPaymentIds: generatedPaymentIds,
    });

    console.log(
      `[Scheduler] Generated ${paymentRequests.length} one-time payments for template ${templateId} ` +
      `(Event: ${eventId}, Next execution: ${nextExecutionDate})`
    );
  } catch (error) {
    console.error(`[Scheduler] Error processing template ${template?.id}:`, error);
  }
}

/**
 * Retry pending hash verifications
 */
export async function retryPendingHashVerifications() {
  const pendingRecords = await listPendingHashVerificationRetries();
  if (!pendingRecords.length) {
    console.log("[Scheduler] No pending hash verification retries");
    return;
  }

  console.log(`[Scheduler] Retrying hash verification for ${pendingRecords.length} records`);

  for (const record of pendingRecords) {
    try {
      const merchantTxnNo = String(record?.transaction?.transaction_id || "").trim();
      const tranCtx = String(record?.gateway?.tranCtx || "").trim();
      const originalTxnNo = String(record?.gateway?.originalTxnNo || "").trim() || merchantTxnNo;

      const statusResult = await checkIciciSaleStatus({ merchantTxnNo, tranCtx, originalTxnNo });

      if (!statusResult.hashVerified) {
        console.log(`[Scheduler] Hash still invalid for record ${record.id}. Keeping pending.`);
        continue;
      }

      const finalStatus = statusResult.status;
      const dbStatusLabel = statusResult.dbStatusLabel || (finalStatus === "success" ? "SUCCESSFUL" : "FAILURE");

      await updatePaymentProcessedById(record.id, {
        status: finalStatus,
        pendingHashVerificationRetry: false,
        transaction: {
          ...(record.transaction || {}),
          status: dbStatusLabel,
          response_code: dbStatusLabel,
          date: new Date().toISOString(),
        },
        gateway: {
          ...(record.gateway || {}),
          statusRequestPacket: statusResult.requestPacket,
          statusResponsePacket: statusResult.responsePacket,
          txnRespDescription: statusResult.txnRespDescription || null,
        },
      });

      if (finalStatus === "success" || finalStatus === "failed") {
        await updatePaymentRequestStatusById(record.paymentRequestId, finalStatus);
      }

      console.log(`[Scheduler] Resolved record ${record.id} to status: ${finalStatus}`);
    } catch (err) {
      console.error(`[Scheduler] Error retrying hash verification for ${record?.id}:`, err);
    }
  }
}

/**
 * Reconcile all pending and recent failed transactions once per day.
 */
export async function reconcilePendingAndFailedTransactions() {
  const records = await listPaymentProcessedForReconciliation();

  if (!records.length) {
    console.log("[Scheduler] No pending or failed internal transactions to reconcile");
    return;
  }

  const paymentRequestIds = [...new Set(records
    .map((record) => String(record?.paymentRequestId || "").trim())
    .filter(Boolean))];

  const contexts = await listPaymentRequestContextsByIds(paymentRequestIds);
  const contextByPaymentRequestId = new Map(
    contexts.map((context) => [String(context.paymentRequestId || "").trim(), context])
  );

  console.log(`[Scheduler] Reconciling ${records.length} pending/failed internal transactions`);

  for (const record of records) {
    await reconcileSinglePaymentRecord(record, contextByPaymentRequestId);
  }
}

/**
 * Sync ICICI settlement totals for previous IST day.
 */
export async function runIciciSettlementSync() {
  try {
    const result = await syncIciciSettlementHistoryForPreviousDay();
    console.log("[Scheduler] ICICI settlement sync completed:", {
      mode: result?.mode || null,
      settlementDate: result?.record?.settlementDate || null,
      totalSettledAmount: result?.record?.totalSettledAmount || 0,
      transactionCount: result?.record?.transactionCount || 0,
      status: result?.record?.status || null,
    });
  } catch (error) {
    console.error("[Scheduler] ICICI settlement sync failed:", error?.message || error);
  }
}

/**
 * Start the recurring templates scheduler
 * Runs daily at midnight (Asia/Kolkata)
 */
export function startRecurringTemplatesScheduler() {
  const task = cron.schedule("0 0 * * *", async () => {
    const now = new Date().toISOString();
    console.log(`[Scheduler] Cron job triggered at ${now} - Starting recurring templates execution`);
    await executeRecurringTemplates();
    await retryPendingHashVerifications();
    await reconcilePendingAndFailedTransactions();
    await runIciciSettlementSync();
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata",
  });

  console.log("[Scheduler] Recurring templates scheduler started (Cron: 0 0 * * * - Daily at midnight)");
  return task;
}
