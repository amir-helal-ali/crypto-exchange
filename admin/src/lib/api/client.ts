// ═══════════════════════════════════════════════════════════
// NEXUS ADMIN v6.0 — API Client
// ═══════════════════════════════════════════════════════════

import { goto } from '$app/navigation';
import type { LoginResponse, ApiResponse } from './types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ── Token Management ────────────────────────────────────
function getToken(): string | null {
	if (typeof window === 'undefined') return null;
	return localStorage.getItem('admin_token');
}

function getRefreshToken(): string | null {
	if (typeof window === 'undefined') return null;
	return localStorage.getItem('admin_refresh_token');
}

export function setTokens(access: string, refresh: string) {
	if (typeof window === 'undefined') return;
	localStorage.setItem('admin_token', access);
	localStorage.setItem('admin_refresh_token', refresh);
}

function clearTokens() {
	if (typeof window === 'undefined') return;
	localStorage.removeItem('admin_token');
	localStorage.removeItem('admin_refresh_token');
	localStorage.removeItem('admin_user');
}

export function isAuthenticated(): boolean {
	return !!getToken();
}

export function getStoredUser() {
	if (typeof window === 'undefined') return null;
	const raw = localStorage.getItem('admin_user');
	if (!raw) return null;
	try { return JSON.parse(raw); } catch { return null; }
}

export function setStoredUser(user: unknown) {
	if (typeof window === 'undefined') return;
	localStorage.setItem('admin_user', JSON.stringify(user));
}

export function logout() {
	clearTokens();
	goto('/login');
}

// ── Auto Token Refresh ──────────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{
	resolve: (v: unknown) => void;
	reject: (e: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
	failedQueue.forEach(({ resolve, reject }) => {
		if (error) reject(error);
		else resolve(token);
	});
	failedQueue = [];
}

async function refreshAccessToken(): Promise<string | null> {
	const refresh = getRefreshToken();
	if (!refresh) return null;

	try {
		const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ refresh_token: refresh })
		});
		if (!res.ok) return null;
		const data = await res.json();
		if (data.success && data.data?.token) {
			setTokens(data.data.token, data.data.refresh_token || refresh);
			return data.data.token;
		}
		return null;
	} catch {
		return null;
	}
}

// ── Core Fetch ──────────────────────────────────────────
async function apiFetch<T>(
	path: string,
	options: RequestInit = {}
): Promise<ApiResponse<T>> {
	const token = getToken();
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		...(options.headers as Record<string, string> || {})
	};
	if (token) headers['Authorization'] = `Bearer ${token}`;

	try {
		const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

		if (res.status === 401) {
			if (isRefreshing) {
				return new Promise((resolve, reject) => {
					failedQueue.push({
						resolve: () => resolve(apiFetch<T>(path, options)),
						reject
					});
				}) as Promise<ApiResponse<T>>;
			}

			isRefreshing = true;
			const newToken = await refreshAccessToken();
			isRefreshing = false;

			if (newToken) {
				processQueue(null, newToken);
				headers['Authorization'] = `Bearer ${newToken}`;
				const retry = await fetch(`${API_BASE}${path}`, { ...options, headers });
				return retry.json();
			} else {
				processQueue(new Error('Refresh failed'), null);
				clearTokens();
				goto('/login');
				return { success: false, error: 'Session expired' };
			}
		}

		return res.json();
	} catch (err) {
		return { success: false, error: err instanceof Error ? err.message : 'Network error' };
	}
}

// ── Exported Helpers ────────────────────────────────────
export async function authGet<T>(path: string) {
	return apiFetch<T>(path, { method: 'GET' });
}

export async function authPost<T>(path: string, body?: unknown) {
	return apiFetch<T>(path, {
		method: 'POST',
		body: body ? JSON.stringify(body) : undefined
	});
}

export async function authPut<T>(path: string, body?: unknown) {
	return apiFetch<T>(path, {
		method: 'PUT',
		body: body ? JSON.stringify(body) : undefined
	});
}

export async function authDelete<T>(path: string) {
	return apiFetch<T>(path, { method: 'DELETE' });
}

export async function authUpload<T>(path: string, file: File) {
	const token = getToken();
	const formData = new FormData();
	formData.append('image', file);

	const res = await fetch(`${API_BASE}${path}`, {
		method: 'POST',
		headers: token ? { Authorization: `Bearer ${token}` } : {},
		body: formData
	});
	return res.json() as Promise<ApiResponse<T>>;
}

// ── Login ───────────────────────────────────────────────
export async function login(email: string, password: string): Promise<LoginResponse> {
	const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password })
	});
	return res.json();
}

export async function verify2FA(code: string, tempToken: string): Promise<LoginResponse> {
	const res = await fetch(`${API_BASE}/api/v1/auth/2fa/verify`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ code, temp_token: tempToken })
	});
	return res.json();
}

// ── SSE Stream ──────────────────────────────────────────
export function createAdminStream(types: string[] = ['*']): EventSource | null {
	const token = getToken();
	if (!token) return null;
	const typesParam = types.join(',');
	return new EventSource(`${API_BASE}/api/v1/admin/stream?token=${token}&types=${typesParam}`);
}

// ── Public Config ───────────────────────────────────────
export async function getPublicConfig() {
	try {
		const res = await fetch(`${API_BASE}/api/v1/config`);
		return res.json();
	} catch {
		return null;
	}
}

export { API_BASE, getToken };
