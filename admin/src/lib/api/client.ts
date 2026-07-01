// ─── API Client ───────────────────────────────────────────────
const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';
export { API };

// ─── Token Management ─────────────────────────────────────────
export function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('admin_token') || '';
}

export function getRefreshToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('admin_refresh_token') || '';
}

export function setTokens(token: string, refreshToken: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('admin_token', token);
  localStorage.setItem('admin_refresh_token', refreshToken);
}

export function setUser(user: any) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('admin_user', JSON.stringify(user));
}

export function getUser(): any {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('admin_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearTokens() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_refresh_token');
  localStorage.removeItem('admin_user');
}

export function isAuthenticated(): boolean {
  return !!getToken() && getUser()?.role === 'ADMIN';
}

// ─── Refresh Queue ────────────────────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (t: string) => void; reject: (e: any) => void }> = [];

function processQueue(error: any, token: string | null = null) {
  failedQueue.forEach(p => error ? p.reject(error) : p.resolve(token!));
  failedQueue = [];
}

async function refreshAccessToken(): Promise<string> {
  const rt = getRefreshToken();
  if (!rt) throw new Error('No refresh token');
  const res = await fetch(`${API}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: rt })
  });
  if (!res.ok) throw new Error('Refresh failed');
  const data = await res.json();
  setTokens(data.token, data.refresh_token);
  return data.token;
}

// ─── Auth Fetch ───────────────────────────────────────────────
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  let response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (newToken) => {
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
    } catch (e) {
      processQueue(e, null);
      clearTokens();
      window.location.href = '/login';
      throw e;
    } finally {
      isRefreshing = false;
    }
  }
  return response;
}

// ─── Convenience Methods ──────────────────────────────────────
export const authGet = (path: string) => authFetch(`${API}${path}`);
export const authPost = (path: string, body?: any) => authFetch(`${API}${path}`, {
  method: 'POST', body: body ? JSON.stringify(body) : undefined
});
export const authPut = (path: string, body?: any) => authFetch(`${API}${path}`, {
  method: 'PUT', body: body ? JSON.stringify(body) : undefined
});
export const authDelete = (path: string) => authFetch(`${API}${path}`, { method: 'DELETE' });
export const authUpload = (path: string, formData: FormData) => authFetch(`${API}${path}`, {
  method: 'POST', body: formData
});
