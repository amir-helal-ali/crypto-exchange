/**
 * API Client with automatic JWT refresh token rotation.
 *
 * How it works:
 * 1. Access token (JWT) expires every 15 minutes
 * 2. When a 401 is received, the client automatically tries to refresh using the refresh token
 * 3. If refresh succeeds, the original request is retried with the new token
 * 4. If refresh fails, the user is redirected to login
 */

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

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
    throw new Error("No refresh token available");
  }

  const res = await fetch(`${API}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) {
    // Refresh token is invalid — force logout
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    window.location.href = "/login";
    throw new Error("Refresh token expired");
  }

  const data = await res.json();
  localStorage.setItem("token", data.token);
  localStorage.setItem("refresh_token", data.refresh_token);
  localStorage.setItem("user", JSON.stringify(data.user));
  return data.token;
}

/**
 * Authenticated fetch wrapper with automatic token refresh.
 * Use this instead of raw fetch() for all authenticated API calls.
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = localStorage.getItem("token");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response = await fetch(url, { ...options, headers });

  // If 401, try to refresh the token
  if (response.status === 401) {
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

/**
 * Convenience method for authenticated GET requests
 */
export async function authGet(path: string): Promise<Response> {
  return authFetch(`${API}${path}`);
}

/**
 * Convenience method for authenticated POST requests
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
 * Convenience method for authenticated PUT requests
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
 * Convenience method for authenticated DELETE requests
 */
export async function authDelete(path: string): Promise<Response> {
  return authFetch(`${API}${path}`, { method: "DELETE" });
}
