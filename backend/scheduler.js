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
} from "./db.js";
import { checkIciciSaleStatus } from "./routes/bank-payment/icici.js";

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

    const generatedPaymentIds = paymentRequests.map(p => p.id);

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
 * Start the recurring templates scheduler
 * Runs daily at midnight (Asia/Kolkata)
 */
export function startRecurringTemplatesScheduler() {
  const task = cron.schedule('0 0 * * *', async () => {
    const now = new Date().toISOString();
    console.log(`[Scheduler] Cron job triggered at ${now} - Starting recurring templates execution`);
    await executeRecurringTemplates();
    await retryPendingHashVerifications();
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });

  console.log("[Scheduler] Recurring templates scheduler started (Cron: 0 0 * * * - Daily at midnight)");
  return task;
}