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
} from "./db.js";


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

export function startRecurringPaymentScheduler() {
  const task = cron.schedule('0 0 * * *', async () => {
    const now = new Date().toISOString();
    console.log(`[Scheduler] Cron job triggered at ${now} - Starting recurring payment execution`);
    await executeRecurringPayments();
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata" 
  });

  console.log("[Scheduler] Recurring payment scheduler started (Cron: 0 0 * * * - Daily at midnight)");
  return task;
}
