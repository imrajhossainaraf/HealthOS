"use client";

// Thin API client for the HealthOS backend. Token lives in localStorage and is
// attached as a Bearer header. All calls return parsed JSON or throw ApiError.

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const TOKEN_KEY = "healthos:token";

export class ApiError extends Error {
  constructor(message, status, details, data) {
    super(message);
    this.status = status;
    this.details = details;
    this.data = data; // full response body (e.g. needsVerification, devCode, email)
  }
}

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
  // Notify auth-aware listeners (sync bridge, useToken) without a storage write.
  window.dispatchEvent(new CustomEvent("healthos:auth"));
}

export async function apiFetch(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Network error — is the server running?", 0);
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    throw new ApiError(
      data?.error || `Request failed (${res.status})`,
      res.status,
      data?.details,
      data
    );
  }
  return data;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/* ---------------- Resource helpers ---------------- */

export const authApi = {
  // Register now starts an email-verification step → { pendingVerification, devCode? }.
  register: (payload) => apiFetch("/api/auth/register", { method: "POST", body: payload, auth: false }),
  verifyOtp: (payload) => apiFetch("/api/auth/verify-otp", { method: "POST", body: payload, auth: false }),
  resendOtp: (email) => apiFetch("/api/auth/resend-otp", { method: "POST", body: { email }, auth: false }),
  login: (payload) => apiFetch("/api/auth/login", { method: "POST", body: payload, auth: false }),
  me: () => apiFetch("/api/auth/me"),
  googleStatus: () => apiFetch("/api/auth/google/status", { auth: false }),
  googleUrl: () => `${API_URL}/api/auth/google`,
};

// Public emergency-card lookup (powers the QR code).
export const userApi = {
  byId: (id) => apiFetch(`/api/users/${encodeURIComponent(id)}`, { auth: false }),
  byPhone: (phone) => apiFetch(`/api/users/by-phone/${encodeURIComponent(phone)}`, { auth: false }),
  // Persist the signed-in user's coordinates so SOS alerts can find them nearby.
  updateLocation: ({ lat, lng }) => apiFetch("/api/users/location", { method: "POST", body: { lat, lng } }),
};

export const storeApi = {
  getAll: () => apiFetch("/api/store"),
  get: (key) => apiFetch(`/api/store/${encodeURIComponent(key)}`),
  put: (key, value) => apiFetch(`/api/store/${encodeURIComponent(key)}`, { method: "PUT", body: { value } }),
};

export const donorApi = {
  list: ({ group, area } = {}) => {
    const qs = new URLSearchParams();
    if (group && group !== "All") qs.set("group", group);
    if (area) qs.set("area", area);
    const q = qs.toString();
    return apiFetch(`/api/donors${q ? `?${q}` : ""}`, { auth: false });
  },
  create: (payload) => apiFetch("/api/donors", { method: "POST", body: payload }),
};

// Shared, cross-user herbal knowledge base.
export const herbApi = {
  list: () => apiFetch("/api/herbs", { auth: false }),
  create: (payload) => apiFetch("/api/herbs", { method: "POST", body: payload }),
};

// Shared, anonymous community symptom / outbreak reports.
export const outbreakApi = {
  list: () => apiFetch("/api/outbreaks", { auth: false }),
  create: (payload) => apiFetch("/api/outbreaks", { method: "POST", body: payload, auth: false }),
};

// Recent broadcast emergency alerts (last few hours).
export const alertApi = {
  list: () => apiFetch("/api/alerts", { auth: false }),
  // Trigger an emergency alert for a registered phone number — notifies that
  // person's guardian + emergency contacts by email and realtime toast.
  trigger: (number) =>
    apiFetch(`/api/alert/${encodeURIComponent(number)}`, { method: "POST", auth: false }),
};

// Prescriptions — records sync via the store; this only emails a schedule.
export const prescriptionApi = {
  email: (prescription, to) =>
    apiFetch("/api/prescriptions/email", { method: "POST", body: { prescription, to } }),
};

// AI Health Copilot (OpenRouter-backed). `chat` requires auth.
export const aiApi = {
  status: () => apiFetch("/api/ai/status", { auth: false }),
  chat: ({ copilot, messages, profile }) =>
    apiFetch("/api/ai/chat", { method: "POST", body: { copilot, messages, profile } }),
};

// Real, cross-user contribution leaderboard.
export const reputationApi = {
  leaderboard: () => apiFetch("/api/reputation/leaderboard", { auth: false }),
  me: () => apiFetch("/api/reputation/me"),
  award: (points, reason) =>
    apiFetch("/api/reputation/award", { method: "POST", body: { points, reason } }),
};
