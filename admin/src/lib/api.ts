/**
 * Admin API Client with automatic JWT refresh token rotation.
 * Mirrors the frontend lib/api.ts but for the admin panel.
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

function forceLogout() {
  localStorage.removeItem("token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
  if (
    typeof window !== "undefined" &&
    !window.location.pathname.startsWith("/login")
  ) {
    window.location.href = "/login";
  }
}

/**
 * Authenticated fetch wrapper with automatic token refresh.
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = localStorage.getItem("token");
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
    throw new Error("تعذر الاتصال بالخادم");
  }

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
      throw new Error("Invalid authentication token");
    }

    // Token expired or unknown 401 — try to refresh
    if (isRefreshing) {
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

// --- Convenience Methods ---

export async function authGet(path: string): Promise<Response> {
  return authFetch(`${API}${path}`);
}

export async function authPost(
  path: string,
  body?: any
): Promise<Response> {
  return authFetch(`${API}${path}`, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function authPut(
  path: string,
  body?: any
): Promise<Response> {
  return authFetch(`${API}${path}`, {
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function authDelete(path: string): Promise<Response> {
  return authFetch(`${API}${path}`, { method: "DELETE" });
}

export async function authUpload(
  path: string,
  formData: FormData
): Promise<Response> {
  return authFetch(`${API}${path}`, {
    method: "POST",
    body: formData,
  });
}
