export function normalizeStoredPaymentStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (["success", "failed", "pending"].includes(normalized)) {
    return normalized;
  }
  return "pending";
}

export function resolveStatusAfterHashVerification(currentStatus, statusResult) {
  const persistedCurrentStatus = normalizeStoredPaymentStatus(currentStatus);

  if (!statusResult?.hashVerified) {
    return {
      shouldPersistFinalStatus: false,
      responseStatus: persistedCurrentStatus,
      persistedStatus: persistedCurrentStatus,
      pendingHashVerificationRetry: true,
    };
  }

  const finalStatus = normalizeStoredPaymentStatus(statusResult?.status);
  return {
    shouldPersistFinalStatus: true,
    responseStatus: finalStatus,
    persistedStatus: finalStatus,
    pendingHashVerificationRetry: false,
  };
}
