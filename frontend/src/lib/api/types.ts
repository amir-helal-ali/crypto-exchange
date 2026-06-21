// ============================================================
// Core API Types
// ============================================================

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

export interface LoginResponse {
  token: string;
  refresh_token: string;
  user: User;
  requires_2fa?: boolean;
  temp_token?: string;
}

export interface PlaceOrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_LIMIT' | 'TAKE_PROFIT';
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

export interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  data: string;
  read: boolean;
  created_at: string;
}

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

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message: string;
  error?: string;
  code?: string;
}

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number = 500) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}
