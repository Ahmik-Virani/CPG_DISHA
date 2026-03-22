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
};

export const eventApi = {
  listMine: (token) => apiRequest("/events", { method: "GET" }, token),
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
};

export const userPaymentApi = {
  getPending: (token) => apiRequest("/user-payments/pending", { method: "GET" }, token),
  getOptional: (token) => apiRequest("/user-payments/optional", { method: "GET" }, token),
  initiateSale: (token, data) =>
    apiRequest("/user-payments/initiate-sale", { method: "POST", body: JSON.stringify(data) }, token),
};
