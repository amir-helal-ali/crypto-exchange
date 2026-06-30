import { API, getToken } from './client';

export interface AdminStats {
  totalUsers: number;
  totalOrders: number;
  totalTransactions: number;
  pendingWithdrawals: number;
  pendingDeposits: number;
  pendingKYC: number;
}

export interface AdminUser {
  id: number;
  email: string;
  username: string;
  role: string;
  email_verified: boolean;
  two_fa_enabled: boolean;
  created_at: string;
}

export interface KYCRequest {
  id: number;
  user_id: number;
  full_name: string;
  document_type: string;
  document_number: string;
  document_url: string;
  status: string;
  rejection_reason: string;
  created_at: string;
  updated_at: string;
  user: { id: number; username: string; email: string };
}

export interface AdminTransaction {
  id: number;
  user_id: number;
  username: string;
  email: string;
  type: string;
  currency: string;
  amount: number;
  status: string;
  address: string;
  tx_id: string;
  createdAt: string;
}

export interface AuditLog {
  id: number;
  user_id: number;
  action: string;
  details: string;
  ipAddress: string;
  username: string;
  createdAt: string;
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

export interface SystemSettings {
  domains: Record<string, string>;
  ssl: Record<string, string>;
  security: Record<string, string>;
  features: Record<string, string>;
}

export interface SSLStatus {
  enabled: boolean;
  type: string;
  exists: boolean;
  issuer: string;
  subject: string;
  domains: string;
  not_after: string;
  days_remaining: number;
  health: string;
  cert_path: string;
  key_path: string;
}

// SSE Stream
export function createAdminStream(types: string[] = ['*']): EventSource | null {
  const token = getToken();
  if (!token) return null;
  const url = `${API}/api/v1/admin/stream?token=${encodeURIComponent(token)}&types=${types.join(',')}`;
  return new EventSource(url);
}
