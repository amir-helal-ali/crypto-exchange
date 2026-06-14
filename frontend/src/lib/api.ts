/**
 * API Client with automatic JWT refresh token rotation.
 *
 * How it works:
 * 1. Access token (JWT) expires every 15 minutes
 * 2. When a 401 is received, the client automatically tries to refresh using the refresh token
 * 3. If refresh succeeds, the original request is retried with the new token
 * 4. If refresh fails, the user is redirected to login
 *
 * Also provides:
 * - FormData upload support
 * - Standardized API response parsing
 * - Network error handling
 */

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// --- Token Refresh Queue ---
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token!);
    }
  });
  failedQueue = [];
};

/**
 * Attempt to refresh the access token using the stored refresh token.
 * Returns the new access token on success.
 */
async function refreshAccessToken(): Promise<string> {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) {
    forceLogout();
    throw new Error("No refresh token available");
  }

  const res = await fetch(`${API}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) {
    forceLogout();
    throw new Error("Refresh token expired");
  }

  const data = await res.json();
  localStorage.setItem("token", data.token);
  localStorage.setItem("refresh_token", data.refresh_token);
  localStorage.setItem("user", JSON.stringify(data.user));
  return data.token;
}

/**
 * Force logout: clear all auth data and redirect to login.
 * Called when both access and refresh tokens are invalid.
 */
function forceLogout() {
  localStorage.removeItem("token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
  // Only redirect if we're not already on login/register pages
  if (
    typeof window !== "undefined" &&
    !window.location.pathname.startsWith("/login") &&
    !window.location.pathname.startsWith("/register") &&
    !window.location.pathname.startsWith("/verify-email") &&
    !window.location.pathname.startsWith("/reset-password") &&
    !window.location.pathname.startsWith("/forgot-password")
  ) {
    window.location.href = "/login";
  }
}

/**
 * Authenticated fetch wrapper with automatic token refresh.
 * Use this instead of raw fetch() for all authenticated API calls.
 *
 * Features:
 * - Auto-sets Authorization header
 * - Auto-refreshes expired JWT tokens (401 → refresh → retry)
 * - Queues concurrent requests during refresh (prevents race conditions)
 * - Handles FormData (file uploads) without setting Content-Type
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = localStorage.getItem("token");

  // Detect if body is FormData — don't set Content-Type (browser sets multipart boundary)
  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (networkError) {
    // Network error (no internet, CORS, server down)
    throw new ApiError("NETWORK_ERROR", "تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.", 0);
  }

  // If 401, check for TOKEN_EXPIRED and try to refresh
  if (response.status === 401) {
    // Try to parse the response to get the error code
    let errorCode = "";
    try {
      const cloned = response.clone();
      const errData = await cloned.json();
      errorCode = errData.code || "";
    } catch {}

    // If the token is invalid (not just expired), don't try to refresh
    if (errorCode === "INVALID_TOKEN" || errorCode === "AUTH_REQUIRED") {
      forceLogout();
      throw new ApiError(errorCode, "رمز المصادقة غير صالح", 401);
    }

    // Token expired or unknown 401 — try to refresh
    if (isRefreshing) {
      // Another refresh is already in progress — queue this request
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (newToken: string) => {
            headers["Authorization"] = `Bearer ${newToken}`;
            resolve(fetch(url, { ...options, headers }));
          },
          reject,
        });
      });
    }

    isRefreshing = true;

    try {
      const newToken = await refreshAccessToken();
      processQueue(null, newToken);

      // Retry the original request with the new token
      headers["Authorization"] = `Bearer ${newToken}`;
      return await fetch(url, { ...options, headers });
    } catch (error) {
      processQueue(error, null);
      throw error;
    } finally {
      isRefreshing = false;
    }
  }

  return response;
}

// --- Custom Error Class ---

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number = 500) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

// --- Standardized API Response Parser ---

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message: string;
  error?: string;
}

/**
 * Parse an API response and throw a standardized error if not ok.
 * Use this for cleaner error handling in components.
 *
 * @example
 * const data = await parseApiResponse<MyData>(res);
 * // data is typed as MyData
 */
export async function parseApiResponse<T = any>(res: Response): Promise<T> {
  const json = await res.json();

  if (!res.ok) {
    throw new ApiError(
      json.code || "UNKNOWN_ERROR",
      json.error || "حدث خطأ غير متوقع",
      res.status
    );
  }

  return json.data ?? json;
}

// --- Convenience Methods ---

/**
 * Authenticated GET request
 */
export async function authGet(path: string): Promise<Response> {
  return authFetch(`${API}${path}`);
}

/**
 * Authenticated POST request with JSON body
 */
export async function authPost(
  path: string,
  body?: any
): Promise<Response> {
  return authFetch(`${API}${path}`, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Authenticated PUT request with JSON body
 */
export async function authPut(
  path: string,
  body?: any
): Promise<Response> {
  return authFetch(`${API}${path}`, {
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Authenticated DELETE request
 */
export async function authDelete(path: string): Promise<Response> {
  return authFetch(`${API}${path}`, { method: "DELETE" });
}

/**
 * Authenticated file upload (FormData)
 */
export async function authUpload(
  path: string,
  formData: FormData
): Promise<Response> {
  return authFetch(`${API}${path}`, {
    method: "POST",
    body: formData,
  });
}
