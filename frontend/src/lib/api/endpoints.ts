import {
  authGet,
  authPost,
  authPut,
  authDelete,
  authUpload,
  publicPost,
  publicGet
} from './client';
import type {
  LoginRequest,
  RegisterRequest,
  LoginResponse,
  PlaceOrderRequest,
  DepositRequest,
  WithdrawRequest,
  KYCSubmitRequest,
  User
} from './types';

// ============================================================
// Auth Endpoints
// ============================================================
export const auth = {
  register: (data: RegisterRequest) => publicPost('/api/v1/auth/register', data),
  login: (data: LoginRequest) => publicPost('/api/v1/auth/login', data),
  forgotPassword: (email: string) =>
    publicPost('/api/v1/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    publicPost('/api/v1/auth/reset-password', { token, password }),
  verifyEmail: (token: string) =>
    publicGet(`/api/v1/auth/verify-email?token=${token}`),
  resendVerification: (email: string) =>
    publicPost('/api/v1/auth/resend-verification', { email }),
  verify2FA: (tempToken: string, code: string) =>
    publicPost('/api/v1/auth/verify-2fa', { temp_token: tempToken, code }),
  refresh: (refreshToken: string) =>
    publicPost('/api/v1/auth/refresh', { refresh_token: refreshToken }),
  setup2FA: () => authPost('/api/v1/auth/setup-2fa'),
  enable2FA: (code: string) => authPost('/api/v1/auth/enable-2fa', { code }),
  disable2FA: (code: string) => authPost('/api/v1/auth/disable-2fa', { code }),
  logout: (refreshToken: string) =>
    authPost('/api/v1/auth/logout', { refresh_token: refreshToken }),
  getSessions: () => authGet('/api/v1/auth/sessions'),
  revokeSession: (id: number) => authPost(`/api/v1/auth/sessions/${id}/revoke`)
};

// ============================================================
// Exchange Endpoints
// ============================================================
export const exchange = {
  placeOrder: (data: PlaceOrderRequest) => authPost('/api/v1/exchange/order', data),
  getOrders: (params?: { symbol?: string; status?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.symbol) query.set('symbol', params.symbol);
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    const qs = query.toString();
    return authGet(`/api/v1/exchange/orders${qs ? `?${qs}` : ''}`);
  },
  cancelOrder: (id: number) => authPost(`/api/v1/exchange/order/${id}/cancel`)
};

// ============================================================
// Wallet Endpoints
// ============================================================
export const wallet = {
  getBalances: () => authGet('/api/v1/wallet/balances'),
  getUserInfo: () => authGet('/api/v1/user/info'),
  updateProfile: (data: Partial<User>) => authPut('/api/v1/user/profile', data),
  changePassword: (currentPassword: string, newPassword: string) =>
    authPost('/api/v1/user/change-password', {
      current_password: currentPassword,
      new_password: newPassword
    }),
  deposit: (data: DepositRequest) => authPost('/api/v1/wallet/deposit', data),
  withdraw: (data: WithdrawRequest) => authPost('/api/v1/wallet/withdraw', data),
  getTransactions: (params?: { page?: number; limit?: number; type?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.type) query.set('type', params.type);
    const qs = query.toString();
    return authGet(`/api/v1/wallet/transactions${qs ? `?${qs}` : ''}`);
  }
};

// ============================================================
// KYC Endpoints
// ============================================================
export const kyc = {
  submit: (data: KYCSubmitRequest) => authPost('/api/v1/kyc/submit', data),
  uploadDocument: (formData: FormData) => authUpload('/api/v1/kyc/upload', formData),
  getStatus: () => authGet('/api/v1/kyc/status')
};

// ============================================================
// Notification Endpoints
// ============================================================
export const notifications = {
  getList: (params?: { limit?: number; unread_only?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.unread_only) query.set('unread_only', 'true');
    const qs = query.toString();
    return authGet(`/api/v1/notifications${qs ? `?${qs}` : ''}`);
  },
  markRead: (id: number) => authPut(`/api/v1/notifications/${id}/read`),
  markAllRead: () => authPut('/api/v1/notifications/read-all')
};

// ============================================================
// Market Endpoints (Public — NEXUS's own market engine)
// ============================================================
export const market = {
  getPrices: () => publicGet('/api/v1/market/prices'),
  getKlines: (symbol: string, interval: string = '1H', limit: number = 300) =>
    publicGet(
      `/api/v1/market/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
    ),
  getTicker: (symbol: string) =>
    publicGet(`/api/v1/market/ticker?symbol=${symbol}`),
  getAllTickers: () => publicGet('/api/v1/market/tickers')
};

// ============================================================
// Fee Endpoints (Public)
// ============================================================
export const fees = {
  getSchedules: () => authGet('/api/v1/fees')
};
