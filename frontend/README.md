# NEXUS Exchange — Frontend (SvelteKit)

واجهة احترافية لمنصة تداول العملات الرقمية مبنية بـ SvelteKit 2 + Svelte 5 + Tailwind CSS.

## 🎨 المميزات

- **تصميم فريد** — نظام تصميم observatory-inspired بألوان أرجوانية/ذهبية/زبرجدية على خلفية داكنة
- **RTL كامل** — واجهة عربية من اليمين لليسار مع خط Tajawal
- **Live Trading** — شارت Canvas مخصص بمؤشرات (SMA, EMA, Bollinger Bands)
- **WebSocket** — بيانات لحظية من Binance (ticker, orderbook, trades, klines)
- **Mobile-first** — تجربة كاملة على الجوال مع tab bar سفلي
- **Glass panels** — تصميم زجاجي مع توهجات لونية متدرجة
- **Type-safe** — TypeScript صارم + Svelte 5 runes
- **Auth + JWT refresh** — معالجة تلقائية لانتهاء صلاحية الـ tokens

## 📦 المتطلبات

- Node.js 20+
- Backend يعمل على `http://localhost:3000` (Gin/Go)

## 🚀 التشغيل

```bash
npm install
npm run dev
# → http://localhost:3001
```

## 🏗️ الإنتاج

```bash
npm run build
node build
```

## 📁 هيكل المشروع

```
src/
├── app.html / app.css          # الإعدادات العامة + نظام التصميم
├── lib/
│   ├── api/
│   │   ├── types.ts            # كل الـ TypeScript interfaces
│   │   ├── client.ts           # authFetch + token refresh queue
│   │   └── endpoints.ts        # كل دوال API مرتبة حسب الوحدة
│   ├── stores/
│   │   ├── auth.ts             # reactive user state
│   │   ├── toast.ts            # notifications
│   │   └── market.ts           # tickers + favorites
│   ├── components/             # مكونات UI أساسية
│   │   ├── Button.svelte
│   │   ├── Input.svelte
│   │   ├── Card.svelte
│   │   ├── Modal.svelte
│   │   ├── Chart.svelte        # شارت شموع Canvas
│   │   ├── OrderBook.svelte
│   │   ├── MarketList.svelte
│   │   ├── TradeForm.svelte
│   │   ├── TradesFeed.svelte
│   │   └── ...
│   └── utils/format.ts         # أدوات التنسيق
└── routes/
    ├── +page.svelte            # landing page
    ├── login/ register/ ...    # صفحات المصادقة
    └── dashboard/
        ├── +layout.svelte      # sidebar + topbar + ticker tape
        ├── +page.svelte        # لوحة التحكم الرئيسية
        ├── exchange/           # صفحة التداول الكاملة
        ├── wallet/             # المحفظة + إيداع/سحب
        ├── history/            # سجل الصفقات
        ├── profile/            # الملف الشخصي
        ├── security/           # 2FA + جلسات + API keys
        ├── notifications/      # الإشعارات
        ├── kyc/                # التحقق من الهوية
        ├── fees/               # جدول الرسوم
        └── admin/              # لوحة الإدارة (users, kyc, transactions, ads, fees)
```

## 🔌 متغيرات البيئة

- `VITE_API_URL` — رابط الـ backend (افتراضي: `http://localhost:3000`)
- `API_URL` — للـ SSR (server-side)

## 🎯 ميزات صفحة التداول

- شارت شموع يابانية تفاعلي (تكبير/تصغير/سحب)
- 5 مؤشرات فنية (SMA20, SMA50, EMA12, EMA26, Bollinger)
- دفتر أوامر لحظي مع رؤوس حجم
- آخر الصفقات (تداولات) لحظياً
- قائمة أسواق مع بحث وفلترة (مفضلة/USDT)
- نموذج تداول (Market/Limit/Stop-Limit) مع حساب الإجمالي ونسبة المحفظة
- جدول أوامر مفتوحة وسجل
- شريط أدوات كامل (تصدير PNG، تكبير، إعادة ضبط)

## 📝 ملاحظات

- الـ WebSocket يربط مباشرة إلى Binance API العام (لا يحتاج مفتاح)
- المصادقة عبر JWT مع refresh token تلقائي
- المحفظة المفضلة محفوظة في localStorage
- يدعم الوضع الليلي فقط (dark theme)
