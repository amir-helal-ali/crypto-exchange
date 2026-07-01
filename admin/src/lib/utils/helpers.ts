// ═══════════════════════════════════════════════════════════
// NEXUS ADMIN v6.0 — Helper Utilities
// ═══════════════════════════════════════════════════════════

export function formatNumber(n: number | undefined | null): string {
	if (n == null) return '—';
	return new Intl.NumberFormat('ar-EG').format(n);
}

export function formatCompact(n: number | undefined | null): string {
	if (n == null) return '—';
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}م`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}ك`;
	return n.toFixed(0);
}

export function formatPercent(n: number | undefined | null): string {
	if (n == null) return '—';
	return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

export function formatCurrency(n: number | undefined | null, currency = 'USD'): string {
	if (n == null) return '—';
	return new Intl.NumberFormat('ar-EG', {
		style: 'currency', currency,
		minimumFractionDigits: 2, maximumFractionDigits: 2
	}).format(n);
}

export function formatDate(d: string | undefined | null): string {
	if (!d) return '—';
	return new Intl.DateTimeFormat('ar-EG', {
		year: 'numeric', month: 'long', day: 'numeric',
		hour: '2-digit', minute: '2-digit'
	}).format(new Date(d));
}

export function formatDateShort(d: string | undefined | null): string {
	if (!d) return '—';
	return new Intl.DateTimeFormat('ar-EG', {
		month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
	}).format(new Date(d));
}

export function timeAgo(d: string | undefined | null): string {
	if (!d) return '—';
	const now = Date.now();
	const then = new Date(d).getTime();
	const diff = Math.floor((now - then) / 1000);
	if (diff < 60) return 'الآن';
	if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
	if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
	if (diff < 2592000) return `منذ ${Math.floor(diff / 86400)} يوم`;
	return formatDate(d);
}

export function truncate(s: string, len = 30): string {
	if (s.length <= len) return s;
	return s.slice(0, len) + '…';
}

export function getInitials(name: string): string {
	return name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

export const actionLabels: Record<string, string> = {
	LOGIN: 'تسجيل دخول',
	LOGOUT: 'تسجيل خروج',
	REGISTER: 'تسجيل حساب',
	UPDATE_USER_ROLE: 'تحديث دور المستخدم',
	ADMIN_VERIFY_EMAIL: 'توثيق البريد',
	REVIEW_KYC: 'مراجعة KYC',
	REVIEW_TRANSACTION: 'مراجعة معاملة',
	UPDATE_FEE_SCHEDULE: 'تحديث الرسوم',
	SETTINGS_UPDATE: 'تحديث الإعدادات',
	SSL_CERT_GENERATED: 'توليد شهادة SSL',
	SSL_CERT_RENEWED: 'تجديد شهادة SSL',
	SSL_CERT_INSTALLED: 'تثبيت شهادة SSL',
	PLACE_ORDER: 'وضع طلب',
	CANCEL_ORDER: 'إلغاء طلب',
	CREATE_WITHDRAWAL: 'طلب سحب',
	DEPOSIT: 'إيداع',
	ENABLE_2FA: 'تفعيل التحقق الثنائي',
	DISABLE_2FA: 'تعطيل التحقق الثنائي'
};

export const statusConfigs: Record<string, { label: string; color: string }> = {
	PENDING: { label: 'قيد الانتظار', color: '#f5b544' },
	APPROVED: { label: 'مقبول', color: '#22d3a4' },
	VERIFIED: { label: 'موثّق', color: '#22d3a4' },
	COMPLETED: { label: 'مكتمل', color: '#22d3a4' },
	REJECTED: { label: 'مرفوض', color: '#fb7185' },
	ACTIVE: { label: 'نشط', color: '#22d3a4' },
	INACTIVE: { label: 'غير نشط', color: '#5a6478' }
};

export const docTypeLabels: Record<string, string> = {
	PASSPORT: 'جواز سفر',
	NATIONAL_ID: 'بطاقة وطنية',
	DRIVERS_LICENSE: 'رخصة قيادة',
	UTILITY_BILL: 'فاتورة مرافق'
};

export function generateAreaChart(
	seed: number, width = 80, height = 28, color = '#f5b544'
): string {
	const data: number[] = [];
	let val = seed % 100;
	for (let i = 0; i < 12; i++) {
		val += Math.sin(seed + i * 0.7) * 15 + 5;
		data.push(Math.max(0, val));
	}
	const max = Math.max(...data);
	const min = Math.min(...data);
	const range = max - min || 1;
	const step = width / (data.length - 1);

	const linePoints = data
		.map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 4) - 2}`)
		.join(' ');

	const areaPath = `M0,${height} L${data.map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 4) - 2}`).join(' L')} L${width},${height} Z`;

	return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
		<defs><linearGradient id="a${seed}" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0%" stop-color="${color}" stop-opacity="0.3"/>
			<stop offset="100%" stop-color="${color}" stop-opacity="0"/>
		</linearGradient></defs>
		<path d="${areaPath}" fill="url(#a${seed})"/>
		<polyline points="${linePoints}" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
	</svg>`;
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
	let timer: ReturnType<typeof setTimeout>;
	return ((...args: unknown[]) => {
		clearTimeout(timer);
		timer = setTimeout(() => fn(...args), ms);
	}) as T;
}

export function copyToClipboard(text: string): Promise<void> {
	return navigator.clipboard.writeText(text);
}

export function formatUptime(ms: number): string {
	const s = Math.floor(ms / 1000);
	const d = Math.floor(s / 86400);
	const h = Math.floor((s % 86400) / 3600);
	const m = Math.floor((s % 3600) / 60);
	const parts: string[] = [];
	if (d > 0) parts.push(`${d} يوم`);
	if (h > 0) parts.push(`${h} ساعة`);
	if (m > 0) parts.push(`${m} دقيقة`);
	return parts.join(' ') || 'أقل من دقيقة';
}
