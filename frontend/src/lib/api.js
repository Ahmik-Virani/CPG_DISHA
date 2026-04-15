const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
export const AUTH_EXPIRED_EVENT = "cpg:auth-expired";

export async function apiRequest(path, options = {}, token) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && token && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(AUTH_EXPIRED_EVENT, {
          detail: {
            path,
            message: payload.message || "Invalid or expired token",
          },
        })
      );
    }
    throw new Error(payload.message || "Request failed");
  }

  return payload;
}

export const authApi = {
  login: (data) => apiRequest("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  signup: (data) => apiRequest("/auth/signup", { method: "POST", body: JSON.stringify(data) }),
  me: (token) => apiRequest("/auth/me", { method: "GET" }, token),
  changePassword: (token, data) =>
    apiRequest("/auth/change-password", { method: "POST", body: JSON.stringify(data) }, token),
};

export const adminApi = {
  listSystemHeads: (token) => apiRequest("/admin/system-heads", { method: "GET" }, token),
  createMerchant: (token, data) =>
    apiRequest("/admin/system-heads", { method: "POST", body: JSON.stringify(data) }, token),
  getSystemHeadPaymentHistory: (token, systemHeadId, eventId) =>
    apiRequest(`/admin/system-heads/${systemHeadId}/payment-history${eventId ? `?eventId=${eventId}` : ""}`, { method: "GET" }, token),
  listBanks: (token) => apiRequest("/admin/banks", { method: "GET" }, token),
  createBank: (token, data) =>
    apiRequest("/admin/banks", { method: "POST", body: JSON.stringify(data) }, token),
  updateBank: (token, bankId, data) =>
    apiRequest("/admin/banks/" + bankId, { method: "PATCH", body: JSON.stringify(data) }, token),
  toggleBankStatus: (token, bankId, enabled) =>
    apiRequest(
      "/admin/banks/" + bankId + "/status",
      { method: "PATCH", body: JSON.stringify({ enabled }) },
      token
    ),
  deleteBank: (token, bankId) => apiRequest("/admin/banks/" + bankId, { method: "DELETE" }, token),
  getIciciSettlementHistory: (token, limit = 30) =>
    apiRequest(`/admin/settlements/icici?limit=${encodeURIComponent(limit)}`, { method: "GET" }, token),
};

export const eventApi = {
  listMine: (token) => apiRequest("/events", { method: "GET" }, token),
  listBankOptions: (token) => apiRequest("/events/banks/options", { method: "GET" }, token),
  getOne: (token, eventId) => apiRequest("/events/" + eventId, { method: "GET" }, token),
  getLatestPaymentRequest: (token, eventId) =>
    apiRequest("/events/" + eventId + "/payment-requests/latest", { method: "GET" }, token),
  create: (token, data) =>
    apiRequest("/events", { method: "POST", body: JSON.stringify(data) }, token),
  markDone: (token, eventId) =>
    apiRequest("/events/" + eventId + "/complete", { method: "PATCH" }, token),
  remove: (token, eventId) => apiRequest("/events/" + eventId, { method: "DELETE" }, token),
  createPaymentRequest: (token, eventId, data) =>
    apiRequest("/events/" + eventId + "/payment-requests", { method: "POST", body: JSON.stringify(data) }, token),
  getTransactionHistory: (token, eventId) =>
    apiRequest(
      "/events/transactions/history" + (eventId ? "?eventId=" + eventId : ""),
      { method: "GET" },
      token
    ),
  deleteFixedPaymentRequest: (token, paymentRequestId) =>
    apiRequest("/events/fixed-payment-requests/" + paymentRequestId, { method: "DELETE" }, token),
  deleteOneTimePaymentRequest: (token, paymentRequestId) =>
    apiRequest("/events/one-time-payment-requests/" + paymentRequestId, { method: "DELETE" }, token),
};

export const userPaymentApi = {
  getPending: (token) => apiRequest("/user-payments/pending", { method: "GET" }, token),
  getOptional: (token) => apiRequest("/user-payments/optional", { method: "GET" }, token),
  getHistory: (token) => apiRequest("/user-payments/history", { method: "GET" }, token),
  initiateSale: (token, data) =>
    apiRequest("/user-payments/initiate-sale", { method: "POST", body: JSON.stringify(data) }, token),
  verifyStatus: (token, data) =>
    apiRequest("/user-payments/verify-status", { method: "POST", body: JSON.stringify(data) }, token),
};

export const externalLinkApi = {
  ensureMyLink: (token) => apiRequest("/external-links/me", { method: "POST" }, token),
  createPaymentUrl: (token, data) =>
    apiRequest("/external-links/me/payment-url", { method: "POST", body: JSON.stringify(data) }, token),
  updateMyLinkStatus: (token, linkId, status) =>
    apiRequest(`/external-links/${linkId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, token),
  resolvePublicLink: (linkId, amount) =>
    apiRequest(
      `/external-links/${encodeURIComponent(linkId)}/resolve?amount=${encodeURIComponent(amount)}`,
      { method: "GET" }
    ),
  initiatePublicPayment: (linkId, data) =>
    apiRequest(`/external-links/${encodeURIComponent(linkId)}/initiate`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getPublicReceipt: (paymentRecordId) =>
    apiRequest(`/external-links/receipt/${encodeURIComponent(paymentRecordId)}`, { method: "GET" }),
  verifyPublicPaymentStatus: (data) =>
    apiRequest("/external-links/verify-status", { method: "POST", body: JSON.stringify(data) }),
};
