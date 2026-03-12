const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

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
};

export const eventApi = {
  listMine: (token) => apiRequest("/events", { method: "GET" }, token),
  getOne: (token, eventId) => apiRequest("/events/" + eventId, { method: "GET" }, token),
  create: (token, data) =>
    apiRequest("/events", { method: "POST", body: JSON.stringify(data) }, token),
  markDone: (token, eventId) =>
    apiRequest("/events/" + eventId + "/complete", { method: "PATCH" }, token),
  remove: (token, eventId) => apiRequest("/events/" + eventId, { method: "DELETE" }, token),
  createPaymentRequest: (token, eventId, data) =>
    apiRequest("/events/" + eventId + "/payment-requests", { method: "POST", body: JSON.stringify(data) }, token),
};
