import { browser } from '$app/environment';
import { ApiError, type ApiResponse } from './types';
import { authStore } from '$lib/stores/auth';

// Re-export types for convenience
export { ApiError };
export type { ApiResponse };

// Backend API base URL.
// Priority (browser): runtime-configured value from /api/v1/config → VITE_API_URL → same-origin
// Priority (server):  process.env.API_URL → VITE_API_URL → http://localhost:3000
//
// The runtime discovery happens in `loadRuntimeConfig()` below — when the
// admin changes backend_domain via the admin panel, the frontend picks
// up the new value on next page load without needing a rebuild.
let runtimeApiBase: string | null = null;

function getInitialApiBase(): string {
  if (browser) {
    // Try cached runtime config first — but validate it's reachable
    // (stale cached values like https://api.eg-money.local cause
    // ERR_CONNECTION_REFUSED when the domain doesn't resolve locally)
    const cached = localStorage.getItem('runtime_api_base');
    if (cached && isCacheValid(cached)) {
      runtimeApiBase = cached;
      return cached;
    }
    // Invalid cache — clear it and fall back to VITE_API_URL
    if (cached) localStorage.removeItem('runtime_api_base');
    return (import.meta.env.VITE_API_URL as string) || '';
  }
  return process.env.API_URL || (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000';
}

/**
 * Validate a cached API base URL. Rejects obviously broken values:
 * - non-localhost .local domains that won't resolve
 * - HTTPS when we're on HTTP page (mixed content)
 */
function isCacheValid(url: string): boolean {
  try {
    const parsed = new URL(url);
    // .local domains only resolve if explicitly added to /etc/hosts
    // In most dev setups they don't — skip them and rediscover
    if (parsed.hostname.endsWith('.local') && parsed.hostname !== 'localhost') {
      return false;
    }
    // If current page is HTTP and cached URL is HTTPS, it won't work
    // (mixed content blocked by browsers)
    if (window.location.protocol === 'http:' && parsed.protocol === 'https:') {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export const API_BASE = getInitialApiBase();

// Load runtime config from backend on first browser load. Updates the
// API_BASE if the admin has changed backend_domain since last visit.
// Safe to call multiple times — only fetches once per session.
let configLoaded = false;
export async function loadRuntimeConfig(): Promise<void> {
  if (!browser || configLoaded) return;
  configLoaded = true;
  try {
    // Fetch from same origin (nginx) — falls back to API_BASE if direct
    const configUrl = API_BASE ? `${API_BASE}/api/v1/config` : '/api/v1/config';
    const res = await fetch(configUrl, { headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) return;
    const data = await res.json();
    if (data.backend_domain) {
      const scheme = data.ssl_enabled ? 'https' : 'http';
      const newBase = `${scheme}://${data.backend_domain}`;
      // Validate before applying — don't cache broken .local or mixed-content URLs
      if (!isCacheValid(newBase)) {
        console.warn(`[runtime-config] Ignoring invalid backend_domain: ${newBase} — keeping ${API_BASE}`);
        return;
      }
      if (newBase !== runtimeApiBase) {
        runtimeApiBase = newBase;
        localStorage.setItem('runtime_api_base', newBase);
        // Reload to apply new API base
        if (API_BASE !== newBase) {
          window.location.reload();
        }
      }
    }
  } catch {
    // Silent failure — fall back to VITE_API_URL
  }
}

// Trigger runtime config load on module import (browser only)
if (browser) {
  loadRuntimeConfig();
}

// --- Token Refresh Queue ---
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) promise.reject(error);
    else promise.resolve(token!);
  });
  failedQueue = [];
};

async function refreshAccessToken(): Promise<string> {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) {
    forceLogout();
    throw new Error('No refresh token available');
  }

  const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken })
  });

  if (!res.ok) {
    forceLogout();
    throw new Error('Refresh token expired');
  }

  const data = await res.json();
  localStorage.setItem('token', data.token);
  localStorage.setItem('refresh_token', data.refresh_token);
  localStorage.setItem('user', JSON.stringify(data.user));
  authStore.setUser(data.user);
  return data.token;
}

export function forceLogout() {
  if (browser) {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    authStore.clear();
    if (
      !window.location.pathname.startsWith('/login') &&
      !window.location.pathname.startsWith('/register') &&
      !window.location.pathname.startsWith('/verify-email') &&
      !window.location.pathname.startsWith('/reset-password') &&
      !window.location.pathname.startsWith('/forgot-password')
    ) {
      window.location.href = '/login';
    }
  }
}

/**
 * Authenticated fetch wrapper with automatic token refresh.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  if (!browser) {
    // Server-side: no token context. Just do plain fetch.
    return fetch(url, options);
  }

  const token = localStorage.getItem('token');
  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>)
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (networkError) {
    throw new ApiError('NETWORK_ERROR', 'تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.', 0);
  }

  if (response.status === 401) {
    let errorCode = '';
    try {
      const cloned = response.clone();
      const errData = await cloned.json();
      errorCode = errData.code || '';
    } catch {}

    if (errorCode === 'INVALID_TOKEN' || errorCode === 'AUTH_REQUIRED') {
      forceLogout();
      throw new ApiError(errorCode, 'رمز المصادقة غير صالح', 401);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (newToken: string) => {
            headers['Authorization'] = `Bearer ${newToken}`;
            resolve(fetch(url, { ...options, headers }));
          },
          reject
        });
      });
    }

    isRefreshing = true;
    try {
      const newToken = await refreshAccessToken();
      processQueue(null, newToken);
      headers['Authorization'] = `Bearer ${newToken}`;
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

// --- Standardized parser ---
export async function parseApiResponse<T = any>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) {
    throw new ApiError(
      json.code || 'UNKNOWN_ERROR',
      json.error || 'حدث خطأ غير متوقع',
      res.status
    );
  }
  return json.data ?? json;
}

// --- Convenience methods ---
export const authGet = (path: string) => authFetch(`${API_BASE}${path}`);
export const authPost = (path: string, body?: any) =>
  authFetch(`${API_BASE}${path}`, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined
  });
export const authPut = (path: string, body?: any) =>
  authFetch(`${API_BASE}${path}`, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined
  });
export const authDelete = (path: string) =>
  authFetch(`${API_BASE}${path}`, { method: 'DELETE' });
export const authUpload = (path: string, formData: FormData) =>
  authFetch(`${API_BASE}${path}`, { method: 'POST', body: formData });

// Public (non-auth) request helpers
export const publicPost = (path: string, body?: any) =>
  fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
export const publicGet = (path: string) => fetch(`${API_BASE}${path}`);
