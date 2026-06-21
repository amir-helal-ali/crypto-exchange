import { browser } from '$app/environment';
import { ApiError, type ApiResponse } from './types';
import { authStore } from '$lib/stores/auth';

// Re-export types for convenience
export { ApiError };
export type { ApiResponse };

// Backend API base URL — empty string means same-origin (handled by SvelteKit proxy in dev)
export const API_BASE =
  (browser ? (import.meta.env.VITE_API_URL as string) : process.env.API_URL) ||
  'http://localhost:3000';

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
