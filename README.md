<div dir="rtl">

# 💰 EgMoney — منصة تداول العملات الرقمية

[![CI/CD Pipeline](https://github.com/amir-helal-ali/crypto-exchange/actions/workflows/ci.yml/badge.svg)](https://github.com/amir-helal-ali/crypto-exchange/actions)
[![Go Version](https://img.shields.io/badge/Go-1.25-00ADD8?logo=go)](https://go.dev/)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-2-FF3E00?logo=svelte)](https://kit.svelte.dev/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-Proprietary-red)]()

منصة متكاملة لتداول العملات الرقمية مبنية بمعمارية مايكروسرفس باستخدام **Go** للواجهة الخلفية، و **SvelteKit** للواجهات الأمامية، مع دعم كامل لـ Docker ونظام إدارة متقدم من لوحة تحكم المدير.

---

## 📑 جدول المحتويات

- [نظرة عامة على المعمارية](#-نظرة-عامة-على-المعمارية)
- [المميزات الرئيسية](#-المميزات-الرئيسية)
- [التقنيات المستخدمة](#-التقنيات-المستخدمة)
- [هيكل المشروع](#-هيكل-المشروع)
- [التشغيل السريع](#-التشغيل-السريع)
- [إعداد بيئة التطوير](#-إعداد-بيئة-التطوير)
- [نظام المنافذ الديناميكي](#-نظام-المنافذ-الديناميكي)
- [لوحة تحكم المدير](#-لوحة-تحكم-المدير)
- [نظام النطاقات](#-نظام-النطاقات)
- [شهادات SSL](#-شهادات-ssl)
- [نظام المصادقة والأمان](#-نظام-المصادقة-والأمان)
- [CI/CD Pipeline](#-cicd-pipeline)
- [النسخ الاحتياطي](#-النسخ-الاحتياطي)
- [استكشاف الأخطاء](#-استكشاف-الأخطاء)
- [الترخيص](#-الترخيص)

---

## 🏗 نظرة عامة على المعمارية

```
┌──────────────────────────────────────────────────────────────┐
│                         الإنترنت (HTTPS)                     │
└───────────────────────┬──────────────────────────────────────┘
                        │
                ┌───────▼────────┐
                │     Nginx      │  إنهاء TLS + بروكسي عكسي
                │  (منفذ 80/443) │  + خدمة تحديات ACME
                └───────┬────────┘
                        │
           ┌────────────┼────────────┬──────────┐
           │            │            │          │
           ▼            ▼            ▼          ▼
     ┌──────────┐ ┌──────────┐ ┌──────────┐
     │ Frontend │ │  Admin   │ │  Backend │
     │ (Svelte) │ │ (Svelte) │ │   (Go)   │
     │  :3001   │ │  :3002   │ │  :3000   │
     └──────────┘ └──────────┘ └────┬─────┘
                                   │
                            ┌──────┴──────┐
                            │             │
                       ┌────▼────┐  ┌─────▼─────┐
                       │Postgres │  │   Redis   │
                       │  :5432  │  │   :6379   │
                       └─────────┘  └───────────┘
```

المنصة تتكون من **5 حاويات Docker** مترابطة:

| الخدمة | التقنية | المنفذ الافتراضي | الوصف |
|--------|---------|------------------|-------|
| **Nginx** | Nginx Alpine | 80 / 443 | بروكسي عكسي + إنهاء SSL |
| **Frontend** | SvelteKit 2 + Svelte 5 | 3001 | واجهة المستخدم للتداول |
| **Admin** | SvelteKit 2 + Svelte 5 | 3002 | لوحة تحكم المدير |
| **Backend** | Go 1.25 + Gin | 3000 | واجهة برمجة التطبيقات |
| **Postgres** | PostgreSQL 16 | 5432 | قاعدة البيانات الرئيسية |
| **Redis** | Redis 7 | 6379 | التخزين المؤقت + تحديد المعدل |

---

## ⭐ المميزات الرئيسية

### واجهة المستخدم (Frontend)
- 🔄 تداول فوري عبر WebSocket مع تحديث الأسعار المباشر
- 📊 رسوم بيانية تفاعلية للأسعار والأحجام
- 💼 إدارة المحافظ متعددة العملات
- 📋 سجل المعاملات والعمليات الكامل
- 🔔 نظام إشعارات فوري
- 📱 تصميم متجاوب يعمل على جميع الأجهزة
- 🌙 وضع داكن فاخر مع تصميم Deep Space

### لوحة تحكم المدير (Admin Panel)
- 📡 بث مباشر عبر SSE للإحصائيات والأحداث
- 👥 إدارة المستخدمين (عرض، تعديل، حذف، تغيير الصلاحيات)
- ✅ مراجعة طلبات KYC مع رفع/رفض ومراجعة المستندات
- 💰 مراقبة المعاملات والعمليات المالية
- 📝 سجل التدقيق التفصيلي لجميع العمليات
- 📢 إدارة الإعلانات التجارية (CRUD كامل)
- 💲 جدول الرسوم والإعمولة قابل للتعديل
- 🔒 حالة شهادات SSL وتجديدها
- ⚙️ إعدادات النظام الشاملة (نطاقات، منافذ، SSL، أمان، ميزات)
- 🚀 نشر الإنتاج بنقرة واحدة (nginx reload)
- 📊 مقاييس البنية التحتية (CPU، RAM، القرص، الشبكة)

### الواجهة الخلفية (Backend)
- 🔐 مصادقة JWT مع تحديث تلقائي للرموز
- 🛡 تأكيد الهوية المزدوج (2FA) للمديرين
- 📊 نظام أسواق متعدد مع أزواج تداول
- 💱 محرك مطابقة الأوامر
- 📧 بريد إلكتروني عبر SMTP مع قوالب
- 🔒 تحديد معدل الطلبات عبر Redis
- 🌐 دعم CORS ديناميكي حسب النطاقات المُعدة

---

## 🛠 التقنيات المستخدمة

### الواجهة الخلفية (Backend)
| التقنية | الإصدار | الاستخدام |
|---------|---------|-----------|
| Go | 1.25 | لغة البرمجة الرئيسية |
| Gin | v1.10 | إطار الويب |
| GORM | v1.25 | ORM لقاعدة البيانات |
| PostgreSQL | 16 | قاعدة البيانات العلائقية |
| Redis | 7 | التخزين المؤقت و PubSub |
| golang-jwt | v5 | رموز المصادقة |
| gorilla/websocket | v1.5 | الاتصالات ثنائية الاتجاه |

### الواجهة الأمامية (Frontend + Admin)
| التقنية | الإصدار | الاستخدام |
|---------|---------|-----------|
| SvelteKit | 2 | إطار التطبيق |
| Svelte | 5 | مكتبة واجهة المستخدم (Runes API) |
| adapter-node | 5 | بناء الإنتاج لـ Node.js |
| Tailwind CSS | 4 | تنسيق المكونات |
| Lucide Svelte | 0.460 | أيقونات SVG |
| Vite | 6 | أداة البناء |

### البنية التحتية
| التقنية | الاستخدام |
|---------|-----------|
| Docker + Compose | تنسيق الحاويات |
| Nginx | بروكسي عكسي + SSL |
| PostgreSQL 16 | قاعدة البيانات |
| Redis 7 | التخزين المؤقت |
| GitHub Actions | CI/CD تلقائي |

---

## 📁 هيكل المشروع

```
crypto-exchange/
├── admin/                      # لوحة تحكم المدير (SvelteKit 2)
│   ├── src/
│   │   ├── lib/
│   │   │   ├── api/           # عميل API + أنواع TypeScript
│   │   │   │   ├── client.ts  # عميل HTTP مع مصادقة JWT + SSE + تحديث الرموز
│   │   │   │   └── types.ts   # جميع أنواع TypeScript
│   │   │   ├── components/    # مكونات UI قابلة لإعادة الاستخدام
│   │   │   │   ├── GlassCard.svelte
│   │   │   │   ├── StatCard.svelte
│   │   │   │   ├── DataTable.svelte
│   │   │   │   ├── Modal.svelte
│   │   │   │   ├── Toast.svelte
│   │   │   │   ├── Toggle.svelte
│   │   │   │   ├── Badge.svelte
│   │   │   │   └── ConfirmDialog.svelte
│   │   │   ├── stores/        # متاجر Svelte (Toast)
│   │   │   └── utils/         # دوال مساعدة
│   │   └── routes/
│   │       ├── login/         # صفحة تسجيل الدخول مع 2FA
│   │       └── dashboard/
│   │           ├── users/     # إدارة المستخدمين
│   │           ├── kyc/       # مراجعة KYC
│   │           ├── transactions/ # المعاملات
│   │           ├── audit-logs/   # سجل التدقيق
│   │           ├── ads/          # الإعلانات
│   │           ├── fees/         # الرسوم
│   │           ├── ssl/          # شهادات SSL
│   │           ├── metrics/      # مقاييس البنية
│   │           └── settings/     # إعدادات النظام (6 تبويبات)
│   ├── Dockerfile
│   └── package.json
│
├── frontend/                   # واجهة المستخدم (SvelteKit 2)
│   ├── src/
│   │   ├── lib/               # مكونات ومتاجر وأدوات
│   │   └── routes/            # صفحات التداول
│   ├── Dockerfile
│   └── package.json
│
├── backend/                    # واجهة برمجة التطبيقات (Go + Gin)
│   ├── handlers/              # معالجات HTTP
│   │   ├── admin.go           # نقاط نهاية المدير
│   │   ├── admin_sse.go       # بث SSE المباشر
│   │   ├── auth.go            # المصادقة والتسجيل
│   │   ├── kyc.go             # مراجعة الهوية
│   │   ├── exchange.go        # محرك التداول
│   │   ├── market.go          # بيانات السوق
│   │   ├── wallet.go          # إدارة المحافظ
│   │   ├── ads.go             # الإعلانات التجارية
│   │   ├── settings.go        # إعدادات النظام
│   │   ├── ssl.go             # إدارة SSL
│   │   ├── metrics.go         # مقاييس الخادم
│   │   ├── notifications.go   # الإشعارات
│   │   ├── health.go          # فحص الصحة
│   │   ├── middleware.go      # الوسائط (JWT, CORS, Rate Limit)
│   │   └── validation.go      # التحقق من المدخلات
│   ├── models/                # نماذج GORM
│   ├── settings/              # إعدادات النظام الديناميكية
│   ├── middleware/             # وسيط المصادقة والصلاحيات
│   ├── Dockerfile
│   ├── go.mod
│   └── main.go
│
├── nginx/                      # بروكسي عكسي
│   ├── Dockerfile
│   ├── nginx.conf.template     # قالب بـ متغيرات ديناميكية
│   └── scripts/
│       ├── entrypoint.sh       # نقطة دخول Nginx
│       └── regen-config.sh     # إعادة توليد الإعدادات من API
│
├── scripts/                    # سكربتات الصيانة
│   ├── backup.sh              # نسخ احتياطي لقاعدة البيانات
│   └── restore.sh             # استعادة النسخة الاحتياطية
│
├── .env.example                # نموذج متغيرات البيئة
├── docker-compose.yml          # تنسيق الإنتاج
├── docker-compose.dev.yml      # تنسيق التطوير
├── DEPLOY.md                   # دليل النشر التفصيلي
└── .github/workflows/ci.yml   # خط أنابيب CI/CD
```

---

## 🚀 التشغيل السريع

### المتطلبات المسبقة

- [Docker](https://docs.docker.com/get-docker/) v24+
- [Docker Compose](https://docs.docker.com/compose/install/) v2.20+
- خادم بنظام Linux (Ubuntu 22.04+ مُوصى به) أو macOS
- ذاكرة RAM: 4 جيجابايت كحد أدنى (8 جيجابايت مُوصى بها)
- مساحة تخزين: 10 جيجابايت كحد أدنى

### خطوات التشغيل

```bash
# 1. استنساخ المشروع
git clone https://github.com/amir-helal-ali/crypto-exchange.git
cd crypto-exchange

# 2. إنشاء ملف البيئة من النموذج
cp .env.example .env

# 3. تعديل المتغيرات الحرجة في .env
#    ⚠️ MUST تغيير هذه القيم قبل التشغيل!
nano .env
```

**المتغيرات التي يجب تغييرها إلزامياً:**

```bash
# مفتاح JWT — يجب أن يكون 32 حرف عشوائي على الأقل
# توليد: openssl rand -hex 32
JWT_SECRET=change-me-to-a-secure-random-string-in-production

# كلمة مرور المدير — 8 أحرف على الأقل مع حرف كبير وصغير ورقم ورمز
ADMIN_PASSWORD=YourSecureAdmin@2024
```

```bash
# 4. بناء وتشغيل جميع الحاويات
docker compose up -d --build

# 5. التحقق من حالة الحاويات
docker compose ps

# 6. متابعة السجلات
docker compose logs -f backend
```

بعد التشغيل، يمكنك الوصول إلى:
| الخدمة | العنوان |
|--------|---------|
| واجهة المستخدم | `http://localhost` |
| لوحة المدير | `http://localhost:3002` |
| واجهة API | `http://localhost:3000` |

---

## 💻 إعداد بيئة التطوير

للتطوير بدون Docker (تشغيل كل خدمة محلياً):

### المتطلبات
- Go 1.25+
- Node.js 20+
- PostgreSQL 16
- Redis 7

### تشغيل Backend
```bash
cd backend
go mod download
go run main.go
```

### تشغيل Frontend
```bash
cd frontend
npm install
npm run dev
```

### تشغيل Admin
```bash
cd admin
npm install
npm run dev
```

### باستخدام Docker Compose للتطوير
```bash
# تشغيل بيئة التطوير (بدون nginx، مع إعادة التحميل الساخن)
docker compose -f docker-compose.dev.yml up -d
```

---

## 🔌 نظام المنافذ الديناميكي

أحد أهم مميزات المنصة هو **نظام المنافذ القابل للتعديل بالكامل** من لوحة تحكم المدير، مقسم إلى 3 مستويات:

### 1. منافذ Nginx (تُطبق فوراً عبر nginx reload)
| المتغير | الافتراضي | الوصف |
|---------|-----------|-------|
| `NGINX_HTTP_PORT` | 80 | منفذ HTTP العام |
| `NGINX_HTTPS_PORT` | 443 | منفذ HTTPS العام |

> 💡 تغيير هذه المنافذ يُطبق فوراً عند الضغط على "نشر الإنتاج" — لا يحتاج إعادة تشغيل Docker.

### 2. منافذ الخدمات الداخلية (تُطبق عبر nginx reload)
| المتغير | الافتراضي | الوصف |
|---------|-----------|-------|
| `BACKEND_INTERNAL_PORT` | 3000 | منفذ API داخل الحاوية |
| `FRONTEND_INTERNAL_PORT` | 3000 | منفذ Frontend داخل الحاوية |
| `ADMIN_INTERNAL_PORT` | 3000 | منفذ Admin داخل الحاوية |

> 💡 هذه المنافذ تُحدّث upstream في إعدادات nginx تلقائياً عند النشر.

### 3. منافذ الوصول المباشر (تتطلب `docker compose up -d`)
| المتغير | الافتراضي | الوصف |
|---------|-----------|-------|
| `BACKEND_HOST_PORT` | 3000 | منفذ API على الخادم |
| `FRONTEND_HOST_PORT` | 3001 | منفذ Frontend على الخادم |
| `ADMIN_HOST_PORT` | 3002 | منفذ Admin على الخادم |

> ⚠️ تغيير هذه المنافذ يتطلب إعادة تشغيل الحاويات لأنها تُعدّل تعيين المنافذ بين الخادم والحاويات.

### آلية العمل

```
لوحة المدير → حفظ الإعدادات → قاعدة البيانات
                                    ↓
الضغط على "نشر الإنتاج" → Backend يكتب trigger file
                                    ↓
                            Nginx sidecar يقرأ trigger
                                    ↓
                            regen-config.sh يقرأ /api/v1/config
                                    ↓
                            يُعوّض المتغيرات في nginx.conf.template
                                    ↓
                            nginx -s reload
```

---

## 🎛 لوحة تحكم المدير

لوحة تحكم المدير مبنية بتصميم **Deep Space** الفاخر — وضع داكن فقط مع تأثيرات glassmorphic وتدرجات aurora.

### صفحات لوحة التحكم

| الصفحة | المسار | الوظيفة |
|--------|--------|---------|
| تسجيل الدخول | `/login` | مصادقة مع تأكيد 2FA |
| الرئيسية | `/dashboard` | إحصائيات مباشرة عبر SSE |
| المستخدمون | `/dashboard/users` | إدارة كاملة (عرض، تعديل، حذف) |
| مراجعة KYC | `/dashboard/kyc` | قبول/رفض المستندات |
| المعاملات | `/dashboard/transactions` | مراقبة العمليات المالية |
| سجل التدقيق | `/dashboard/audit-logs` | تتبع جميع العمليات |
| الإعلانات | `/dashboard/ads` | CRUD للإعلانات التجارية |
| الرسوم | `/dashboard/fees` | جدول العمولات |
| SSL | `/dashboard/ssl` | حالة الشهادات وتجديدها |
| المقاييس | `/dashboard/metrics` | CPU، RAM، القرص، الشبكة |
| الإعدادات | `/dashboard/settings` | 6 تبويبات شاملة |

### تبويبات الإعدادات

| التبويب | الإعدادات |
|---------|-----------|
| 🌐 النطاقات | النطاق الرئيسي، Frontend، Backend، Admin |
| 🔌 المنافذ | منافذ Nginx + الخدمات الداخلية + الوصول المباشر |
| 🔒 SSL | تفعيل، مسار الشهادة، مسار المفتاح |
| 🛡 الأمان | أصول CORS الإضافية |
| ⚡ الميزات | فتح التسجيل، وضع الصيانة، رسالة الصيانة |
| 🚀 الإنتاج | ملخص التغييرات + نشر بنقرة واحدة |

### نظام التصميم — Deep Space

| العنصر | القيمة | الاستخدام |
|--------|--------|-----------|
| 🟡 Gold | `#f5b544` | التمييز الرئيسي، الأزرار، الروابط |
| 🟣 Violet | `#a855f7` | التمييز الثانوي، التدرجات |
| 🟢 Mint | `#22d3a4` | النجاح، الحالات الإيجابية |
| 🔵 Azure | `#3b82f6` | المعلومات، الروابط |
| 🔴 Rose | `#fb7185` | الأخطاء، التحذيرات، الحالات السلبية |
| 🌑 Background | `#070b14` | الخلفية الرئيسية |
| 🔮 Glass | `rgba(255,255,255,0.03)` | خلفية البطاقات الزجاجية |

---

## 🌐 نظام النطاقات

### تغيير النطاقات من لوحة المدير

1. اذهب إلى **الإعدادات → النطاقات**
2. عدّل النطاقات المطلوبة:
   - **النطاق الرئيسي**: `example.com`
   - **نطاق Frontend**: `app.example.com`
   - **نطاق Backend**: `api.example.com`
   - **نطاق Admin**: `admin.example.com`
3. اضغط **حفظ الإعدادات**
4. اذهب إلى **الإعدادات → الإنتاج** واضغط **نشر الإنتاج**

### آلية التطبيق

عند نشر الإنتاج:
1. يحفظ Backend الإعدادات في قاعدة البيانات
2. يُحدّث ملف `.env` بالقيم الجديدة
3. يكتب إلى ملف trigger المشترك
4. Nginx sidecar يقرأ trigger ويُعيد توليد الإعدادات
5. يُنفّذ `nginx -s reload` لتطبيق التغييرات

> 💡 **تغيير النطاقات لا يحتاج إعادة تشغيل Docker** — يكفي نشر الإنتاج من لوحة المدير.

---

## 🔒 شهادات SSL

### تفعيل SSL

1. اذهب إلى **الإعدادات → SSL** في لوحة المدير
2. فعّل SSL وأدخل مسارات الشهادة والمفتاح
3. أو استخدم Let's Encrypt تلقائياً:
   ```bash
   # من الخادم
   docker compose exec backend ./egmoney-backend -ssl-auto
   ```

### التحقق من حالة SSL

من لوحة المدير: **SSL → حالة الشهادات** تعرض:
- تاريخ الانتهاء
- المُصدر
- النطاقات المغطاة
- حالة التجديد

---

## 🛡 نظام المصادقة والأمان

### مصادقة المدير

```
تسجيل الدخول (بريد + كلمة مرور)
          ↓
    تأكيد 2FA (رمز TOTP)
          ↓
    إصدار JWT (Access + Refresh)
          ↓
    تحديث تلقائي قبل الانتهاء
          ↓
    طوابير الطلبات الفاشلة أثناء التحديث
```

### ميزات الأمان

| الميزة | التفاصيل |
|--------|----------|
| **JWT** | رموز وصول قصيرة الأمد + رموز تحديث طويلة الأمد |
| **2FA** | تأكيد TOTP إلزامي للمديرين |
| **Rate Limiting** | تحديد معدل الطلبات عبر Redis (أو ذاكرة مؤقتة) |
| **CORS** | أصول ديناميكية حسب النطاقات المُعدة |
| **Helmet** | رؤوس أمان HTTP |
| **Validation** | التحقق من المدخلات في Frontend و Backend |
| **Encryption** | تشفير كلمات المرور بـ bcrypt |

---

## 🔄 CI/CD Pipeline

يتم تشغيل خط أنابيب CI/CD تلقائياً عبر GitHub Actions عند كل push أو pull request:

```
Push → [Backend Test] → [Frontend Build] → [Admin Build] → [Docker Build] → [Security Audit]
```

### مراحل Pipeline

| المرحلة | ما يتم تنفيذه |
|---------|---------------|
| **Go Backend** | `go vet` → `gofmt` → `go test -race` → `go build` |
| **Frontend** | `npm ci` → `next lint` → `npm run build` |
| **Admin** | `npm ci` → `npm run build` |
| **Docker Build** | بناء صور Backend + Frontend + Admin (فقط على master/main) |
| **Security Audit** | `npm audit --audit-level=high` |

> 💡 مرحلة Docker Build تعمل فقط عند الـ push على فرع `master` أو `main`.

---

## 💾 النسخ الاحتياطي

### إنشاء نسخة احتياطية
```bash
./scripts/backup.sh
# يُنشئ ملف: backups/crypto_exchange_YYYYMMDD_HHMMSS.sql.gz
```

### استعادة نسخة احتياطية
```bash
./scripts/restore.sh backups/crypto_exchange_20240101_120000.sql.gz
```

> ⚠️ الاستعادة تُلغي جميع البيانات الحالية. تأكد من عمل نسخة قبل الاستعادة.

---

## 🔧 استكشاف الأخطاء

### الحاويات لا تبدأ

```bash
# التحقق من السجلات
docker compose logs backend
docker compose logs nginx

# التحقق من المتغيرات المطلوبة
docker compose config

# إعادة البناء من الصفر
docker compose down -v
docker compose up -d --build
```

### خطأ JWT_SECRET مفقود

```bash
# في ملف .env، تأكد من تعيين:
JWT_SECRET=$(openssl rand -hex 32)
```

### Nginx لا يُعيد التوجيه بشكل صحيح

```bash
# التحقق من إعدادات nginx المُولدة
docker compose exec nginx cat /etc/nginx/nginx.conf

# إعادة توليد الإعدادات يدوياً
docker compose exec nginx /scripts/regen-config.sh

# إعادة تحميل nginx
docker compose exec nginx nginx -s reload
```

### المنافذ لا تتغير بعد التعديل من لوحة المدير

- **منافذ Nginx والداخلية**: اضغط "نشر الإنتاج" في الإعدادات
- **منافذ الوصول المباشر**: يجب تنفيذ `docker compose up -d` على الخادم

---

## 📄 الترخيص

هذا المشروع مملوك وخاص. جميع الحقوق محفوظة © 2024 EgMoney. لا يجوز نسخ أو توزيع أو تعديل هذا المشروع بدون إذن كتابي مسبق.

---

<div align="center">

**تم التطوير بـ ❤️ باستخدام Go + SvelteKit + Docker**

</div>

</div>
