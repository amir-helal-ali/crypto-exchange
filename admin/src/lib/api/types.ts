import { API, getToken } from './client';

// ─── Admin Stats ──────────────────────────────────────────────
export interface AdminStats {
  totalUsers: number;
  totalOrders: number;
  totalTransactions: number;
  pendingWithdrawals: number;
  pendingDeposits: number;
  pendingKYC: number;
  totalVolume24h?: number;
  activeUsers24h?: number;
}

// ─── Users ────────────────────────────────────────────────────
export interface AdminUser {
  id: number;
  email: string;
  username: string;
  role: string;
  email_verified: boolean;
  two_fa_enabled: boolean;
  kyc_status?: 'VERIFIED' | 'PENDING' | 'REJECTED' | 'NONE';
  created_at: string;
  last_login?: string;
  balance?: number;
}

export interface UserStats {
  total: number;
  admins: number;
  emailVerified: number;
  kycVerified: number;
  newToday: number;
  activeToday: number;
}

// ─── KYC ──────────────────────────────────────────────────────
export interface KYCRequest {
  id: number;
  user_id: number;
  full_name: string;
  document_type: string;
  document_number: string;
  document_url: string;
  selfie_url?: string;
  status: string;
  rejection_reason: string;
  created_at: string;
  updated_at: string;
  user: { id: number; username: string; email: string };
}

export interface KYCStats {
  pending: number;
  approved: number;
  rejected: number;
}

// ─── Transactions ─────────────────────────────────────────────
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

// ─── Audit Logs ───────────────────────────────────────────────
export interface AuditLog {
  id: number;
  user_id: number;
  action: string;
  details: string;
  ipAddress: string;
  username: string;
  createdAt: string;
}

// ─── Ads ──────────────────────────────────────────────────────
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

// ─── Fees ─────────────────────────────────────────────────────
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

// ─── System Settings ──────────────────────────────────────────
export interface SystemSettings {
  domains: Record<string, string>;
  ssl: Record<string, string>;
  security: Record<string, string>;
  features: Record<string, string>;
}

// ─── SSL Status ───────────────────────────────────────────────
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

// ─── Metrics ──────────────────────────────────────────────────
export interface MetricsData {
  cpu: number;
  memory: number;
  disk: number;
  uptime: number;
  goroutines: number;
  activeConnections: number;
  requestsPerSecond: number;
  errorRate: number;
}

// ─── Pagination ───────────────────────────────────────────────
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: PaginationMeta;
}

// ─── SSE Stream ───────────────────────────────────────────────
export function createAdminStream(types: string[] = ['*']): EventSource | null {
  const token = getToken();
  if (!token) return null;
  const url = `${API}/api/v1/admin/stream?token=${encodeURIComponent(token)}&types=${types.join(',')}`;
  return new EventSource(url);
}
