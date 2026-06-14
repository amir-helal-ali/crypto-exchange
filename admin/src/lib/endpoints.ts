/**
 * Admin API Endpoint Functions
 *
 * Typed functions for all admin panel API endpoints.
 */

import { authGet, authPost, authPut, authDelete, authUpload } from "./api";

// ============================================================
// Type Definitions
// ============================================================

export interface AdminUser {
  id: number;
  email: string;
  username: string;
  role: string;
  email_verified: boolean;
  two_fa_enabled: boolean;
  created_at: string;
}

export interface AdminKYCRequest {
  id: number;
  user_id: number;
  full_name: string;
  document_type: string;
  document_number: string;
  document_url: string;
  status: string;
  rejection_reason: string;
  created_at: string;
  user?: { username: string; email: string };
}

export interface AdminTransaction {
  id: number;
  user_id: number;
  type: string;
  currency: string;
  amount: number;
  status: string;
  address: string;
  tx_id: string;
  created_at: string;
  user?: { username: string; email: string };
}

export interface AdminStats {
  totalUsers: number;
  totalOrders: number;
  totalTransactions: number;
  pendingWithdrawals: number;
  pendingDeposits: number;
  pendingKYC: number;
}

export interface FeeSchedule {
  id: number;
  user_type: string;
  order_type: string;
  maker_fee: number;
  taker_fee: number;
  min_fee: number;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: number;
  user_id: number;
  action: string;
  details: string;
  ip_address: string;
  created_at: string;
  user?: { username: string; email: string };
}

export interface Ad {
  id: number;
  title: string;
  link: string;
  image_url: string;
  button_text: string;
  button_link: string;
  position: string;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Admin Endpoints
// ============================================================

export const admin = {
  // Dashboard
  getStats: () =>
    authGet("/api/v1/admin/stats"),

  // Users
  getUsers: (params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", params.page.toString());
    if (params?.limit) query.set("limit", params.limit.toString());
    const qs = query.toString();
    return authGet(`/api/v1/admin/users${qs ? `?${qs}` : ""}`);
  },

  updateUserRole: (userId: number, role: string) =>
    authPut(`/api/v1/admin/user/${userId}/role`, { role }),

  // KYC
  getKYCRequests: () =>
    authGet("/api/v1/admin/kyc"),

  reviewKYC: (id: number, status: string, rejectionReason?: string) => {
    const body: any = { status };
    if (status === "REJECTED" && rejectionReason) {
      body.rejection_reason = rejectionReason;
    }
    return authPut(`/api/v1/admin/kyc/${id}/review`, body);
  },

  // Transactions
  getTransactions: (params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", params.page.toString());
    if (params?.limit) query.set("limit", params.limit.toString());
    const qs = query.toString();
    return authGet(`/api/v1/admin/transactions${qs ? `?${qs}` : ""}`);
  },

  reviewTransaction: (id: number, action: string, txId?: string) =>
    authPut(`/api/v1/admin/transactions/${id}/review`, { action, tx_id: txId }),

  // Audit Logs
  getAuditLogs: (params?: { page?: number; limit?: number; action?: string; user_id?: number; search?: string; date_from?: string; date_to?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", params.page.toString());
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.action) query.set("action", params.action);
    if (params?.user_id) query.set("user_id", params.user_id.toString());
    if (params?.search) query.set("search", params.search);
    if (params?.date_from) query.set("date_from", params.date_from);
    if (params?.date_to) query.set("date_to", params.date_to);
    const qs = query.toString();
    return authGet(`/api/v1/admin/audit-logs${qs ? `?${qs}` : ""}`);
  },

  exportAuditLogsCSV: (params?: { action?: string; user_id?: number; date_from?: string; date_to?: string }) => {
    const query = new URLSearchParams();
    if (params?.action) query.set("action", params.action);
    if (params?.user_id) query.set("user_id", params.user_id.toString());
    if (params?.date_from) query.set("date_from", params.date_from);
    if (params?.date_to) query.set("date_to", params.date_to);
    const qs = query.toString();
    return authGet(`/api/v1/admin/audit-logs/export${qs ? `?${qs}` : ""}`);
  },

  // Ads
  getAds: () =>
    authGet("/api/v1/admin/ads"),

  createAd: (data: Partial<Ad>) =>
    authPost("/api/v1/admin/ads", data),

  updateAd: (id: number, data: Partial<Ad>) =>
    authPut(`/api/v1/admin/ads/${id}`, data),

  deleteAd: (id: number) =>
    authDelete(`/api/v1/admin/ads/${id}`),

  uploadAdImage: (formData: FormData) =>
    authUpload("/api/v1/admin/ads/upload", formData),

  suggestAd: (prompt: string) =>
    authPost("/api/v1/admin/ads/suggest", { prompt }),

  // Fees
  getFeeSchedules: () =>
    authGet("/api/v1/admin/fees"),

  updateFeeSchedule: (id: number, data: { maker_fee?: number; taker_fee?: number; min_fee?: number }) =>
    authPut(`/api/v1/admin/fees/${id}`, data),
};
