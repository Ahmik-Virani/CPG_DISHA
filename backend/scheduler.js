import crypto from "node:crypto";
import cron from "node-cron";
import {
  listRecurringPaymentRequestsForExecution,
  updateRecurringPaymentRequestById,
  createFixedPaymentRequestRecord,
  findEventByIdForSystemHead,
  createEventRecord,
  updateRecurringEventInstanceCounter,
  findUserById,
  listPendingHashVerificationRetries,
  updatePaymentProcessedById,
  updatePaymentRequestStatusById,
} from "./db.js";
import { checkIciciSaleStatus } from "./routes/bank-payment/icici.js";


function calculateNextExecutionDate(currentDate, intervalValue, intervalUnit) {
  const nextDate = new Date(currentDate);
  if (intervalUnit === "days") {
    nextDate.setDate(nextDate.getDate() + intervalValue);
  } else if (intervalUnit === "months") {
    nextDate.setMonth(nextDate.getMonth() + intervalValue);
  }
  return nextDate;
}

export async function executeRecurringPayments() {
  try {
    const recurringPayments = await listRecurringPaymentRequestsForExecution();

    if (!recurringPayments.length) {
      console.log("[Scheduler] No recurring payments to execute");
      return;
    }

    console.log(`[Scheduler] Processing ${recurringPayments.length} recurring payments`);

    for (const payment of recurringPayments) {
      await processRecurringPayment(payment);
    }

    console.log("[Scheduler] Recurring payments execution completed");
  } catch (error) {
    console.error("[Scheduler] Error executing recurring payments:", error);
  }
}

async function processRecurringPayment(paymentRequest) {
  try {
    const {
      id: paymentRequestId,
      amount,
      bank,
      banks,
      recurringMode,
      intervalValue,
      intervalUnit,
      eventId: templateEventId,
      createdBySystemHeadId,
    } = paymentRequest;

    const now = new Date().toISOString();

    const templateEvent = await findEventByIdForSystemHead(templateEventId, createdBySystemHeadId);
    if (!templateEvent) {
      console.error(`[Scheduler] Template event ${templateEventId} not found`);
      return;
    }

    const nextInstanceNumber = (templateEvent.instanceCounter || 0) + 1;
    const instanceEventName = `${templateEvent.name} #${nextInstanceNumber}`;

    const systemHead = await findUserById(createdBySystemHeadId);
    const instanceEvent = {
      id: crypto.randomUUID(),
      name: instanceEventName,
      description: templateEvent.description,
      createdBySystemHeadId,
      createdBySystemHeadName: systemHead?.name || "",
      isOngoing: true,
      type: "fixed",
      templateEventId: templateEventId, 
      instanceNumber: nextInstanceNumber,
      createdAt: now,
      updatedAt: now,
    };

    await createEventRecord(instanceEvent);
    console.log(`[Scheduler] Created instance event #${nextInstanceNumber} (${instanceEvent.id}) for template ${templateEventId}`);

    const fixedPaymentRequest = {
      id: crypto.randomUUID(),
      createdBySystemHeadId,
      eventId: instanceEvent.id, 
      type: "fixed",
      bank: bank || banks?.[0] || null,
      banks: banks || [],
      isAmountFixed: true,
      amount,
      createdAt: now,
      updatedAt: now,
    };

    await createFixedPaymentRequestRecord(fixedPaymentRequest);
    console.log(`[Scheduler] Created fixed payment request ${fixedPaymentRequest.id} for instance #${nextInstanceNumber}`);

    await updateRecurringEventInstanceCounter(templateEventId, nextInstanceNumber);

    let updateFields = { lastExecutedAt: now };

    if (recurringMode === "interval" && intervalValue && intervalUnit) {
      const nextExecutionDate = calculateNextExecutionDate(
        new Date(),
        intervalValue,
        intervalUnit
      ).toISOString();
      updateFields.nextExecutionDate = nextExecutionDate;
    } else if (recurringMode === "date") {
      updateFields.status = "inactive";
    }

    await updateRecurringPaymentRequestById(paymentRequestId, updateFields);

    console.log(
      `[Scheduler] Updated recurring payment ${paymentRequestId}. Mode: ${recurringMode}, Next instance: #${nextInstanceNumber + 1}`
    );
  } catch (error) {
    console.error(
      `[Scheduler] Error processing recurring payment ${paymentRequest?.id}:`,
      error
    );
  }
}

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

export function startRecurringPaymentScheduler() {
  const task = cron.schedule('0 0 * * *', async () => {
    const now = new Date().toISOString();
    console.log(`[Scheduler] Cron job triggered at ${now} - Starting recurring payment execution`);
    await executeRecurringPayments();
    await retryPendingHashVerifications();
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });

  console.log("[Scheduler] Recurring payment scheduler started (Cron: 0 0 * * * - Daily at midnight)");
  return task;
}
