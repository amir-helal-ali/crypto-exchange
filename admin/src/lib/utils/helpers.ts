// ─── Number Formatting ───
export function formatNumber(n: number): string {
  return n.toLocaleString('ar-EG');
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('ar-EG');
}

export function formatPercent(n: number, decimals: number = 3): string {
  return `${n.toFixed(decimals)}%`;
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(amount);
}

// ─── Date Formatting ───
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ar-EG', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) return formatDate(iso);
  if (days > 0) return `منذ ${days} يوم`;
  if (hours > 0) return `منذ ${hours} ساعة`;
  if (minutes > 0) return `منذ ${minutes} دقيقة`;
  return 'الآن';
}

// ─── Text Helpers ───
export function maskString(s: string, visibleChars: number = 4): string {
  if (!s || s.length <= visibleChars) return s;
  return s.slice(0, -visibleChars).replace(/./g, '\u2022') + s.slice(-visibleChars);
}

export function truncate(s: string, maxLen: number = 40): string {
  if (!s || s.length <= maxLen) return s;
  return s.slice(0, maxLen - 3) + '...';
}

export function getInitials(name: string): string {
  if (!name) return '؟';
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? parts[0][0] + parts[1][0]
    : parts[0].slice(0, 2);
}

// ─── Action Labels (Arabic) ───
export const actionLabels: Record<string, string> = {
  REGISTER: 'تسجيل',
  LOGIN: 'تسجيل دخول',
  LOGIN_2FA: 'تسجيل 2FA',
  LOGOUT: 'تسجيل خروج',
  EMAIL_VERIFIED: 'توثيق بريد',
  UPDATE_USER_ROLE: 'تحديث دور',
  KYC_SUBMITTED: 'تقديم KYC',
  KYC_APPROVED: 'قبول KYC',
  KYC_REJECTED: 'رفض KYC',
  DEPOSIT_APPROVED: 'قبول إيداع',
  DEPOSIT_REJECTED: 'رفض إيداع',
  WITHDRAWAL_APPROVED: 'قبول سحب',
  WITHDRAWAL_REJECTED: 'رفض سحب',
  ORDER_PLACED: 'طلب جديد',
  ORDER_CANCELLED: 'إلغاء طلب',
  SETTINGS_UPDATE: 'تحديث إعدادات',
  PASSWORD_CHANGED: 'تغيير كلمة مرور',
  TWO_FA_ENABLED: 'تفعيل 2FA',
  TWO_FA_DISABLED: 'تعطيل 2FA',
  PROFILE_UPDATED: 'تحديث ملف',
  REVIEW_KYC: 'مراجعة KYC',
  REVIEW_TRANSACTION: 'مراجعة معاملة',
};

export function getActionLabel(action: string): string {
  return actionLabels[action] || action;
}

// ─── Status Config ───
export interface StatusConfig {
  label: string;
  pillClass: string;
  color: string;
  bg: string;
}

export const statusConfigs: Record<string, StatusConfig> = {
  PENDING: { label: 'قيد المراجعة', pillClass: 'pill-gold', color: '#f5b544', bg: 'rgba(245,181,68,0.12)' },
  APPROVED: { label: 'مقبول', pillClass: 'pill-mint', color: '#22d3a4', bg: 'rgba(34,211,164,0.12)' },
  VERIFIED: { label: 'موثّق', pillClass: 'pill-mint', color: '#22d3a4', bg: 'rgba(34,211,164,0.12)' },
  COMPLETED: { label: 'مكتمل', pillClass: 'pill-mint', color: '#22d3a4', bg: 'rgba(34,211,164,0.12)' },
  REJECTED: { label: 'مرفوض', pillClass: 'pill-rose', color: '#f43f7a', bg: 'rgba(244,63,122,0.12)' },
  ACTIVE: { label: 'نشط', pillClass: 'pill-mint', color: '#22d3a4', bg: 'rgba(34,211,164,0.12)' },
  INACTIVE: { label: 'غير نشط', pillClass: 'pill-rose', color: '#f43f7a', bg: 'rgba(244,63,122,0.12)' },
  NONE: { label: 'لا يوجد', pillClass: 'pill-azure', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
};

export function getStatusConfig(status: string): StatusConfig {
  return statusConfigs[status] || statusConfigs.PENDING;
}

// ─── Document Type Labels ───
export const docTypeLabels: Record<string, string> = {
  PASSPORT: 'جواز سفر',
  NATIONAL_ID: 'بطاقة وطنية',
  DRIVERS_LICENSE: 'رخصة قيادة',
  UTILITY_BILL: 'فاتورة مرافق',
  BANK_STATEMENT: 'كشف حساب بنكي',
  SELFIE: 'صورة شخصية'
};

export function getDocTypeLabel(type: string): string {
  return docTypeLabels[type] || type;
}

// ─── Sparkline SVG Generator ───
export function generateSparkline(color: string, seed: number = 0, width: number = 80, height: number = 28): string {
  const points: string[] = [];
  const steps = 8;
  let y = height / 2;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width;
    const variation = Math.sin(seed * 7 + i * 3.7) * 6;
    y = Math.max(4, Math.min(height - 4, height / 2 + variation));
    points.push(`${x},${y}`);
  }
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" class="opacity-30">
    <polyline points="${points.join(' ')}" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`;
}

// ─── Debounce ───
export function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

// ─── Copy to Clipboard ───
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ─── Action Pill Class Lookup ───
export const actionPillClass: Record<string, string> = {
  REGISTER: 'pill-azure',
  LOGIN: 'pill-azure',
  LOGIN_2FA: 'pill-violet',
  LOGOUT: 'pill-rose',
  UPDATE_USER_ROLE: 'pill-violet',
  KYC_SUBMITTED: 'pill-azure',
  KYC_APPROVED: 'pill-mint',
  KYC_REJECTED: 'pill-rose',
  DEPOSIT_APPROVED: 'pill-mint',
  DEPOSIT_REJECTED: 'pill-rose',
  WITHDRAWAL_APPROVED: 'pill-mint',
  WITHDRAWAL_REJECTED: 'pill-rose',
  ORDER_PLACED: 'pill-gold',
  ORDER_CANCELLED: 'pill-rose',
  SETTINGS_UPDATE: 'pill-violet'
};

export function getActionPill(action: string): string {
  return actionPillClass[action] || 'pill-azure';
}
