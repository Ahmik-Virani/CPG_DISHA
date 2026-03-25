export function formatPaymentType(type) {
  if (type === "one_time") {
    return "One-Time";
  }

  if (type === "fixed") {
    return "Fixed";
  }

  return "Unknown";
}
