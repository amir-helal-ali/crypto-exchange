/**
 * Typed API Endpoint Functions
 *
 * This module provides named, typed functions for every API endpoint.
 * Each function wraps the corresponding authFetch call with proper
 * TypeScript types for request and response data.
 *
 * Usage:
 *   import { auth, exchange, wallet } from '@/lib/endpoints';
 *   const { data } = await auth.login({ email, password });
 */

import { authGet, authPost, authPut, authDelete, authUpload } from "./api";

// ============================================================
// Type Definitions
// ============================================================

// --- Auth ---
export interface LoginRequest {
  email: string;
  password: string;
  two_fa_code?: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

export interface User {
  id: number;
  email: string;
  username: string;
  full_name: string;
  role: string;
  email_verified: boolean;
  two_fa_enabled: boolean;
  created_at: string;
}

export interface LoginResponse {
  token: string;
  refresh_token: string;
  user: User;
  requires_2fa?: boolean;
  temp_token?: string;
}

// --- Exchange ---
export interface PlaceOrderRequest {
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT" | "STOP_LIMIT" | "TAKE_PROFIT";
  quantity: number;
  price?: number;
  stop_price?: number;
}

export interface Order {
  id: number;
  symbol: string;
  side: string;
  type: string;
  price: number;
  stop_price: number;
  quantity: number;
  filled_quantity: number;
  avg_fill_price: number;
  fee: number;
  fee_currency: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// --- Wallet ---
export interface WalletBalance {
  id: number;
  currency: string;
  balance: number;
}

export interface DepositRequest {
  currency: string;
  amount: number;
  tx_id?: string;
}

export interface WithdrawRequest {
  currency: string;
  amount: number;
  address: string;
  two_fa_code?: string;
}

export interface Transaction {
  id: number;
  type: string;
  currency: string;
  amount: number;
  status: string;
  address: string;
  tx_id: string;
  created_at: string;
}

// --- KYC ---
export interface KYCSubmitRequest {
  full_name: string;
  document_type: string;
  document_number: string;
  document_url: string;
}

export interface KYCStatus {
  id: number;
  status: string;
  full_name: string;
  document_type: string;
  rejection_reason?: string;
  created_at: string;
}

// --- Notifications ---
export interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  data: string;
  read: boolean;
  created_at: string;
}

// --- Market ---
export interface MarketPrice {
  symbol: string;
  price: string;
}

export interface Kline {
  open_time: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  close_time: number;
}

// ============================================================
// Auth Endpoints
// ============================================================

export const auth = {
  register: (data: RegisterRequest) =>
    authPost("/api/v1/auth/register", data),

  login: (data: LoginRequest) =>
    authPost("/api/v1/auth/login", data),

  forgotPassword: (email: string) =>
    authPost("/api/v1/auth/forgot-password", { email }),

  resetPassword: (token: string, password: string) =>
    authPost("/api/v1/auth/reset-password", { token, password }),

  verifyEmail: (token: string) =>
    authGet(`/api/v1/auth/verify-email?token=${token}`),

  resendVerification: (email: string) =>
    authPost("/api/v1/auth/resend-verification", { email }),

  verify2FA: (tempToken: string, code: string) =>
    authPost("/api/v1/auth/verify-2fa", { temp_token: tempToken, code }),

  refresh: (refreshToken: string) =>
    authPost("/api/v1/auth/refresh", { refresh_token: refreshToken }),

  setup2FA: () =>
    authPost("/api/v1/auth/setup-2fa"),

  enable2FA: (code: string) =>
    authPost("/api/v1/auth/enable-2fa", { code }),

  disable2FA: (code: string) =>
    authPost("/api/v1/auth/disable-2fa", { code }),

  logout: (refreshToken: string) =>
    authPost("/api/v1/auth/logout", { refresh_token: refreshToken }),

  getSessions: () =>
    authGet("/api/v1/auth/sessions"),

  revokeSession: (id: number) =>
    authPost(`/api/v1/auth/sessions/${id}/revoke`),
};

// ============================================================
// Exchange Endpoints
// ============================================================

export const exchange = {
  placeOrder: (data: PlaceOrderRequest) =>
    authPost("/api/v1/exchange/order", data),

  getOrders: (params?: { symbol?: string; status?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.symbol) query.set("symbol", params.symbol);
    if (params?.status) query.set("status", params.status);
    if (params?.page) query.set("page", params.page.toString());
    if (params?.limit) query.set("limit", params.limit.toString());
    const qs = query.toString();
    return authGet(`/api/v1/exchange/orders${qs ? `?${qs}` : ""}`);
  },

  cancelOrder: (id: number) =>
    authPost(`/api/v1/exchange/order/${id}/cancel`),
};

// ============================================================
// Wallet Endpoints
// ============================================================

export const wallet = {
  getBalances: () =>
    authGet("/api/v1/wallet/balances"),

  getUserInfo: () =>
    authGet("/api/v1/user/info"),

  updateProfile: (data: Partial<User>) =>
    authPut("/api/v1/user/profile", data),

  changePassword: (currentPassword: string, newPassword: string) =>
    authPost("/api/v1/user/change-password", {
      current_password: currentPassword,
      new_password: newPassword,
    }),

  deposit: (data: DepositRequest) =>
    authPost("/api/v1/wallet/deposit", data),

  withdraw: (data: WithdrawRequest) =>
    authPost("/api/v1/wallet/withdraw", data),

  getTransactions: (params?: { page?: number; limit?: number; type?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", params.page.toString());
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.type) query.set("type", params.type);
    const qs = query.toString();
    return authGet(`/api/v1/wallet/transactions${qs ? `?${qs}` : ""}`);
  },
};

// ============================================================
// KYC Endpoints
// ============================================================

export const kyc = {
  submit: (data: KYCSubmitRequest) =>
    authPost("/api/v1/kyc/submit", data),

  uploadDocument: (formData: FormData) =>
    authUpload("/api/v1/kyc/upload", formData),

  getStatus: () =>
    authGet("/api/v1/kyc/status"),
};

// ============================================================
// Notification Endpoints
// ============================================================

export const notifications = {
  getList: (params?: { limit?: number; unread_only?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.unread_only) query.set("unread_only", "true");
    const qs = query.toString();
    return authGet(`/api/v1/notifications${qs ? `?${qs}` : ""}`);
  },

  markRead: (id: number) =>
    authPut(`/api/v1/notifications/${id}/read`),

  markAllRead: () =>
    authPut("/api/v1/notifications/read-all"),
};

// ============================================================
// Market Endpoints (Public)
// ============================================================

export const market = {
  getPrices: () =>
    authGet("/api/v1/market/prices"),

  getKlines: (symbol: string, interval: string = "1h", limit: number = 100) =>
    authGet(`/api/v1/market/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`),
};

// ============================================================
// Fee Endpoints (Public)
// ============================================================

export const fees = {
  getSchedules: () =>
    authGet("/api/v1/fees"),
};
