import type { ApiError } from "@/types";

// ============================================================
// Centralized API Client
// ============================================================

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export const WS_BASE_URL = API_BASE_URL.replace(/^http/, "ws");

/**
 * Custom error class that carries the HTTP status code and API detail message.
 */
export class ApiRequestError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiRequestError";
    this.status = status;
    this.detail = detail;
  }
}

/**
 * Core fetch wrapper.
 * - Automatically prepends `API_BASE_URL`.
 * - Attaches `Authorization: Bearer <token>` when available.
 * - Parses JSON responses and throws `ApiRequestError` on non-2xx.
 * - Attempts a silent token refresh on 401 and retries once.
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  _retry = false,
): Promise<T> {
  const headers = new Headers(options.headers);

  // Default Content-Type for JSON payloads
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  // Attach access token if present
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token")
      : null;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // ------ Handle 401 — attempt silent refresh ------
  if (response.status === 401 && !_retry) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return request<T>(endpoint, options, true);
    }
    // Refresh failed → clear session, redirect to login
    clearSession();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }

  // ------ Parse response ------
  if (!response.ok) {
    let detail = "Đã xảy ra lỗi không xác định.";
    try {
      const body: ApiError = await response.json();
      detail = body.detail || detail;
    } catch {
      // response body is not JSON
    }
    throw new ApiRequestError(response.status, detail);
  }

  // Some endpoints return 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  // Check if the response is JSON
  const contentType = response.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) {
    return response.json() as Promise<T>;
  }

  return response.text() as unknown as T;
}

// ============================================================
// Token Refresh
// ============================================================

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken =
    typeof window !== "undefined"
      ? localStorage.getItem("refresh_token")
      : null;

  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    localStorage.setItem("access_token", data.access_token);
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// Session helpers
// ============================================================

function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
  document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
}

// ============================================================
// Public API helpers
// ============================================================

export const api = {
  get<T>(endpoint: string) {
    return request<T>(endpoint, { method: "GET" });
  },

  post<T>(endpoint: string, body?: unknown) {
    return request<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(endpoint: string, body?: unknown) {
    return request<T>(endpoint, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(endpoint: string) {
    return request<T>(endpoint, { method: "DELETE" });
  },
};
