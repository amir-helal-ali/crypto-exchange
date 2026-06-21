<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { theme, type ThemeMode } from '$lib/stores/theme';
  import { toasts } from '$lib/stores/toast';
  import { usdEgpRate } from '$lib/utils/currency';
  import {
    Settings as SettingsIcon,
    Sun,
    Moon,
    Monitor,
    Bell,
    Globe,
    DollarSign,
    Languages,
    Shield,
    Palette,
    Check,
    Mail,
    Smartphone,
    Loader2,
    Volume2,
    Vibrate,
    Eye,
    Lock,
    ChevronLeft,
    Info
  } from 'lucide-svelte';

  let saving = $state(false);
  let activeTab = $state<'appearance' | 'notifications' | 'trading' | 'security' | 'currency'>('appearance');

  // Appearance settings
  let themeMode = $state<ThemeMode>('dark');
  let accentColor = $state('gold');
  let density = $state<'comfortable' | 'compact'>('comfortable');
  let chartType = $state<'candles' | 'line' | 'area'>('candles');
  let animationsEnabled = $state(true);

  // Notifications
  let emailNotifs = $state({ price: true, security: true, trades: true, newsletter: false });
  let pushNotifs = $state({ price: true, security: true, trades: true });
  let smsNotifs = $state({ security: true, trades: false });
  let soundEnabled = $state(true);
  let vibrateEnabled = $state(true);

  // Trading
  let defaultOrderType = $state<'market' | 'limit'>('limit');
  let confirmOrders = $state(true);
  let showOrderBook = $state(true);
  let slippageTolerance = $state(0.5);
  let defaultLeverage = $state(1);

  // Currency
  let displayCurrency = $state('EGP');
  let rate = $state(48.5);
  let autoUpdateRate = $state(true);

  const unsubRate = usdEgpRate.subscribe((r) => (rate = r));

  const accentColors = [
    { id: 'gold', name: 'ذهبي', value: '#f5b800' },
    { id: 'violet', name: 'بنفسجي', value: '#8b5cf6' },
    { id: 'rose', name: 'وردي', value: '#f43f5e' },
    { id: 'emerald', name: 'زمردي', value: '#10b981' },
    { id: 'cyan', name: 'سماوي', value: '#06b6d4' },
    { id: 'amber', name: 'كهرماني', value: '#f59e0b' }
  ];

  onMount(() => {
    loadSettings();
  });

  onDestroy(() => unsubRate());

  function loadSettings() {
    try {
      const raw = localStorage.getItem('nexus-settings');
      if (raw) {
        const s = JSON.parse(raw);
        if (s.themeMode) themeMode = s.themeMode;
        if (s.accentColor) accentColor = s.accentColor;
        if (s.density) density = s.density;
        if (s.chartType) chartType = s.chartType;
        if (s.animationsEnabled !== undefined) animationsEnabled = s.animationsEnabled;
        if (s.emailNotifs) emailNotifs = s.emailNotifs;
        if (s.pushNotifs) pushNotifs = s.pushNotifs;
        if (s.smsNotifs) smsNotifs = s.smsNotifs;
        if (s.soundEnabled !== undefined) soundEnabled = s.soundEnabled;
        if (s.vibrateEnabled !== undefined) vibrateEnabled = s.vibrateEnabled;
        if (s.defaultOrderType) defaultOrderType = s.defaultOrderType;
        if (s.confirmOrders !== undefined) confirmOrders = s.confirmOrders;
        if (s.showOrderBook !== undefined) showOrderBook = s.showOrderBook;
        if (s.slippageTolerance) slippageTolerance = s.slippageTolerance;
        if (s.defaultLeverage) defaultLeverage = s.defaultLeverage;
        if (s.displayCurrency) displayCurrency = s.displayCurrency;
        if (s.autoUpdateRate !== undefined) autoUpdateRate = s.autoUpdateRate;
      }
      // Sync theme mode
      const tRaw = localStorage.getItem('nexus-theme');
      if (tRaw) {
        try { themeMode = JSON.parse(tRaw).mode; } catch {}
      }
    } catch {}
  }

  async function saveSettings() {
    saving = true;
    try {
      const settings = {
        themeMode, accentColor, density, chartType, animationsEnabled,
        emailNotifs, pushNotifs, smsNotifs, soundEnabled, vibrateEnabled,
        defaultOrderType, confirmOrders, showOrderBook, slippageTolerance, defaultLeverage,
        displayCurrency, autoUpdateRate
      };
      localStorage.setItem('nexus-settings', JSON.stringify(settings));
      await new Promise((r) => setTimeout(r, 800));
      toasts.success('تم حفظ الإعدادات بنجاح');
    } catch {
      toasts.error('فشل في حفظ الإعدادات');
    } finally {
      saving = false;
    }
  }

  function setThemeMode(mode: ThemeMode) {
    themeMode = mode;
    theme.setMode(mode);
  }

  function resetSettings() {
    if (!confirm('هل أنت متأكد من إعادة ضبط جميع الإعدادات؟')) return;
    localStorage.removeItem('nexus-settings');
    loadSettings();
    toasts.info('تمت إعادة ضبط الإعدادات');
  }

  const tabs = [
    { id: 'appearance', label: 'المظهر', icon: Palette },
    { id: 'notifications', label: 'الإشعارات', icon: Bell },
    { id: 'trading', label: 'التداول', icon: DollarSign },
    { id: 'currency', label: 'العملة', icon: Globe },
    { id: 'security', label: 'الأمان', icon: Shield }
  ] as const;
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div class="flex items-center gap-3">
      <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-accent-gold to-accent-violet flex items-center justify-center">
        <SettingsIcon size={22} class="text-ink-950" />
      </div>
      <div>
        <h1 class="text-2xl font-bold text-white">الإعدادات</h1>
        <p class="text-sm text-slate-400">خصص تجربتك على NEXUS Exchange</p>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <button
        onclick={resetSettings}
        class="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
      >
        إعادة ضبط
      </button>
      <button
        onclick={saveSettings}
        disabled={saving}
        class="px-5 py-2 rounded-xl bg-gradient-to-r from-accent-gold to-accent-violet text-ink-950 font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
      >
        {#if saving}
          <Loader2 size={14} class="animate-spin" />
          جاري الحفظ...
        {:else}
          <Check size={14} />
          حفظ التغييرات
        {/if}
      </button>
    </div>
  </div>

  <!-- Tabs -->
  <div class="panel p-2">
    <div class="flex gap-1 overflow-x-auto scrollbar-none">
      {#each tabs as tab}
        <button
          onclick={() => (activeTab = tab.id)}
          class="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap {activeTab === tab.id
            ? 'bg-accent-gold/15 text-accent-gold'
            : 'text-slate-400 hover:text-white hover:bg-white/5'}"
        >
          <tab.icon size={16} />
          {tab.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- Tab Content -->
  <div class="panel p-6">
    <!-- APPEARANCE -->
    {#if activeTab === 'appearance'}
      <div class="space-y-8">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <Palette size={18} class="text-accent-gold" />
            <h2 class="text-base font-bold text-white">المظهر</h2>
          </div>
          <p class="text-xs text-slate-400 mb-5">خصص شكل وألوان المنصة</p>
        </div>

        <!-- Theme Mode -->
        <div>
          <label class="block text-sm font-semibold text-white mb-3">وضع الثيم</label>
          <div class="grid grid-cols-3 gap-3">
            {#each [['dark', 'داكن', Moon], ['light', 'فاتح', Sun], ['system', 'النظام', Monitor]] as [val, label, Icon]}
              <button
                onclick={() => setThemeMode(val as ThemeMode)}
                class="relative p-4 rounded-xl border-2 transition-all {themeMode === val
                  ? 'border-accent-gold bg-accent-gold/5'
                  : 'border-white/5 bg-ink-900/40 hover:border-white/10'}"
              >
                <Icon size={20} class="mx-auto mb-2 {themeMode === val ? 'text-accent-gold' : 'text-slate-400'}" />
                <p class="text-sm font-medium {themeMode === val ? 'text-accent-gold' : 'text-slate-300'}">{label}</p>
                {#if themeMode === val}
                  <div class="absolute top-2 left-2 w-4 h-4 rounded-full bg-accent-gold flex items-center justify-center">
                    <Check size={10} class="text-ink-950" />
                  </div>
                {/if}
              </button>
            {/each}
          </div>
        </div>

        <!-- Accent Color -->
        <div>
          <label class="block text-sm font-semibold text-white mb-3">اللون المميز</label>
          <div class="flex flex-wrap gap-3">
            {#each accentColors as c}
              <button
                onclick={() => (accentColor = c.id)}
                class="relative w-12 h-12 rounded-full transition-all {accentColor === c.id ? 'ring-2 ring-offset-2 ring-offset-ink-950 ring-white scale-110' : 'hover:scale-105'}"
                style="background-color: {c.value}"
                title={c.name}
              >
                {#if accentColor === c.id}
                  <Check size={18} class="text-ink-950 absolute inset-0 m-auto" />
                {/if}
              </button>
            {/each}
          </div>
        </div>

        <!-- Density -->
        <div>
          <label class="block text-sm font-semibold text-white mb-3">كثافة العرض</label>
          <div class="grid grid-cols-2 gap-3">
            {#each [['comfortable', 'مريح', 'مسافات أكبر، أسهل للقراءة'], ['compact', 'مضغوط', 'عناصر أكثر في نفس المساحة']] as [val, label, desc]}
              <button
                onclick={() => (density = val as any)}
                class="p-4 rounded-xl border-2 transition-all text-right {density === val
                  ? 'border-accent-gold bg-accent-gold/5'
                  : 'border-white/5 bg-ink-900/40 hover:border-white/10'}"
              >
                <p class="text-sm font-bold {density === val ? 'text-accent-gold' : 'text-white'}">{label}</p>
                <p class="text-[10px] text-slate-400 mt-0.5">{desc}</p>
              </button>
            {/each}
          </div>
        </div>

        <!-- Chart Type -->
        <div>
          <label class="block text-sm font-semibold text-white mb-3">نوع الرسم البياني الافتراضي</label>
          <div class="grid grid-cols-3 gap-3">
            {#each [['candles', 'شموع يابانية'], ['line', 'خطي'], ['area', 'مساحي']] as [val, label]}
              <button
                onclick={() => (chartType = val as any)}
                class="p-3 rounded-xl border-2 transition-all {chartType === val
                  ? 'border-accent-gold bg-accent-gold/5 text-accent-gold'
                  : 'border-white/5 bg-ink-900/40 text-slate-300 hover:border-white/10'}"
              >
                <p class="text-sm font-medium">{label}</p>
              </button>
            {/each}
          </div>
        </div>

        <!-- Animations -->
        <div class="flex items-center justify-between p-4 bg-ink-900/40 rounded-xl border border-white/5">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-accent-violet/15 flex items-center justify-center">
              <Eye size={16} class="text-accent-violet" />
            </div>
            <div>
              <p class="text-sm font-medium text-white">تفعيل الرسوم المتحركة</p>
              <p class="text-[11px] text-slate-400">انتقالات سلسة وتأثيرات بصرية</p>
            </div>
          </div>
          <button
            onclick={() => (animationsEnabled = !animationsEnabled)}
            class="relative w-12 h-6 rounded-full transition-colors {animationsEnabled ? 'bg-accent-gold' : 'bg-white/10'}"
          >
            <span class="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform {animationsEnabled ? 'translate-x-0.5' : 'translate-x-6'}"></span>
          </button>
        </div>
      </div>
    {:else if activeTab === 'notifications'}
      <div class="space-y-6">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <Bell size={18} class="text-accent-gold" />
            <h2 class="text-base font-bold text-white">الإشعارات</h2>
          </div>
          <p class="text-xs text-slate-400 mb-5">تحكم في كيفية تلقي الإشعارات</p>
        </div>

        <!-- Channels matrix -->
        <div class="space-y-3">
          <!-- Email -->
          <div class="bg-ink-900/40 rounded-xl border border-white/5 overflow-hidden">
            <div class="flex items-center gap-3 px-4 py-3 border-b border-white/5">
              <Mail size={16} class="text-accent-gold" />
              <p class="text-sm font-bold text-white">البريد الإلكتروني</p>
            </div>
            <div class="divide-y divide-white/5">
              {#each [['price', 'تنبيهات الأسعار', emailNotifs.price], ['security', 'تنبيهات الأمان', emailNotifs.security], ['trades', 'تأكيد الصفقات', emailNotifs.trades], ['newsletter', 'النشرة البريدية', emailNotifs.newsletter]] as [key, label, val]}
                <div class="flex items-center justify-between px-4 py-2.5">
                  <span class="text-sm text-slate-300">{label}</span>
                  <button
                    onclick={() => { emailNotifs[key as keyof typeof emailNotifs] = !val; }}
                    class="relative w-11 h-5 rounded-full transition-colors {val ? 'bg-accent-gold' : 'bg-white/10'}"
                  >
                    <span class="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform {val ? 'translate-x-0.5' : 'translate-x-6'}"></span>
                  </button>
                </div>
              {/each}
            </div>
          </div>

          <!-- Push -->
          <div class="bg-ink-900/40 rounded-xl border border-white/5 overflow-hidden">
            <div class="flex items-center gap-3 px-4 py-3 border-b border-white/5">
              <Smartphone size={16} class="text-accent-violet" />
              <p class="text-sm font-bold text-white">إشعارات المتصفح / التطبيق</p>
            </div>
            <div class="divide-y divide-white/5">
              {#each [['price', 'تنبيهات الأسعار', pushNotifs.price], ['security', 'تنبيهات الأمان', pushNotifs.security], ['trades', 'تنفيذ الصفقات', pushNotifs.trades]] as [key, label, val]}
                <div class="flex items-center justify-between px-4 py-2.5">
                  <span class="text-sm text-slate-300">{label}</span>
                  <button
                    onclick={() => { pushNotifs[key as keyof typeof pushNotifs] = !val; }}
                    class="relative w-11 h-5 rounded-full transition-colors {val ? 'bg-accent-gold' : 'bg-white/10'}"
                  >
                    <span class="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform {val ? 'translate-x-0.5' : 'translate-x-6'}"></span>
                  </button>
                </div>
              {/each}
            </div>
          </div>

          <!-- SMS -->
          <div class="bg-ink-900/40 rounded-xl border border-white/5 overflow-hidden">
            <div class="flex items-center gap-3 px-4 py-3 border-b border-white/5">
              <Smartphone size={16} class="text-accent-rose" />
              <p class="text-sm font-bold text-white">رسائل SMS</p>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-accent-rose/10 text-accent-rose">قد يتم تطبيق رسوم</span>
            </div>
            <div class="divide-y divide-white/5">
              {#each [['security', 'تنبيهات الأمان الحرجة', smsNotifs.security], ['trades', 'تأكيد الصفقات الكبيرة', smsNotifs.trades]] as [key, label, val]}
                <div class="flex items-center justify-between px-4 py-2.5">
                  <span class="text-sm text-slate-300">{label}</span>
                  <button
                    onclick={() => { smsNotifs[key as keyof typeof smsNotifs] = !val; }}
                    class="relative w-11 h-5 rounded-full transition-colors {val ? 'bg-accent-gold' : 'bg-white/10'}"
                  >
                    <span class="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform {val ? 'translate-x-0.5' : 'translate-x-6'}"></span>
                  </button>
                </div>
              {/each}
            </div>
          </div>
        </div>

        <!-- Sound & Vibration -->
        <div class="grid grid-cols-2 gap-3">
          <div class="flex items-center justify-between p-3 bg-ink-900/40 rounded-xl border border-white/5">
            <div class="flex items-center gap-2">
              <Volume2 size={14} class="text-slate-400" />
              <span class="text-xs text-slate-300">أصوات الإشعارات</span>
            </div>
            <button
              onclick={() => (soundEnabled = !soundEnabled)}
              class="relative w-10 h-5 rounded-full transition-colors {soundEnabled ? 'bg-accent-gold' : 'bg-white/10'}"
            >
              <span class="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform {soundEnabled ? 'translate-x-0.5' : 'translate-x-5'}"></span>
            </button>
          </div>
          <div class="flex items-center justify-between p-3 bg-ink-900/40 rounded-xl border border-white/5">
            <div class="flex items-center gap-2">
              <Vibrate size={14} class="text-slate-400" />
              <span class="text-xs text-slate-300">الاهتزاز</span>
            </div>
            <button
              onclick={() => (vibrateEnabled = !vibrateEnabled)}
              class="relative w-10 h-5 rounded-full transition-colors {vibrateEnabled ? 'bg-accent-gold' : 'bg-white/10'}"
            >
              <span class="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform {vibrateEnabled ? 'translate-x-0.5' : 'translate-x-5'}"></span>
            </button>
          </div>
        </div>
      </div>
    {:else if activeTab === 'trading'}
      <div class="space-y-6">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <DollarSign size={18} class="text-accent-gold" />
            <h2 class="text-base font-bold text-white">إعدادات التداول</h2>
          </div>
          <p class="text-xs text-slate-400 mb-5">تخصيص سلوك واجهة التداول</p>
        </div>

        <!-- Default order type -->
        <div>
          <label class="block text-sm font-semibold text-white mb-3">نوع الأمر الافتراضي</label>
          <div class="grid grid-cols-2 gap-3">
            {#each [['market', 'أمر سوقي', 'ينفذ فوراً بأفضل سعر متاح'], ['limit', 'أمر محدد', 'ينتظر حتى يصل السعر المحدد']] as [val, label, desc]}
              <button
                onclick={() => (defaultOrderType = val as any)}
                class="p-4 rounded-xl border-2 transition-all text-right {defaultOrderType === val
                  ? 'border-accent-gold bg-accent-gold/5'
                  : 'border-white/5 bg-ink-900/40 hover:border-white/10'}"
              >
                <p class="text-sm font-bold {defaultOrderType === val ? 'text-accent-gold' : 'text-white'}">{label}</p>
                <p class="text-[10px] text-slate-400 mt-0.5">{desc}</p>
              </button>
            {/each}
          </div>
        </div>

        <!-- Slippage -->
        <div>
          <label class="block text-sm font-semibold text-white mb-3">تفاوت السعر المسموح (Slippage)</label>
          <div class="flex items-center gap-2 mb-2">
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              bind:value={slippageTolerance}
              class="flex-1 accent-accent-gold"
            />
            <span class="text-sm font-mono text-white font-bold w-16 text-left">{slippageTolerance.toFixed(1)}%</span>
          </div>
          <div class="flex gap-2">
            {#each [0.1, 0.5, 1.0, 2.0] as v}
              <button
                onclick={() => (slippageTolerance = v)}
                class="px-3 py-1 text-xs rounded-md transition-all {slippageTolerance === v
                  ? 'bg-accent-gold/20 text-accent-gold font-bold'
                  : 'bg-ink-900/50 text-slate-400 hover:text-white'}"
              >
                {v}%
              </button>
            {/each}
          </div>
        </div>

        <!-- Default leverage -->
        <div>
          <label class="block text-sm font-semibold text-white mb-3">الرافعة المالية الافتراضية</label>
          <div class="flex flex-wrap gap-2">
            {#each [1, 2, 5, 10, 20, 50] as lev}
              <button
                onclick={() => (defaultLeverage = lev)}
                class="px-4 py-2 rounded-lg text-sm transition-all {defaultLeverage === lev
                  ? 'bg-accent-gold/20 text-accent-gold font-bold border border-accent-gold/40'
                  : 'bg-ink-900/50 text-slate-400 hover:text-white border border-white/5'}"
              >
                {lev}x
              </button>
            {/each}
          </div>
        </div>

        <!-- Toggles -->
        <div class="space-y-3">
          <div class="flex items-center justify-between p-4 bg-ink-900/40 rounded-xl border border-white/5">
            <div>
              <p class="text-sm font-medium text-white">تأكيد الأوامر قبل التنفيذ</p>
              <p class="text-[11px] text-slate-400">اطلب تأكيداً قبل وضع كل صفقة</p>
            </div>
            <button
              onclick={() => (confirmOrders = !confirmOrders)}
              class="relative w-12 h-6 rounded-full transition-colors {confirmOrders ? 'bg-accent-gold' : 'bg-white/10'}"
            >
              <span class="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform {confirmOrders ? 'translate-x-0.5' : 'translate-x-6'}"></span>
            </button>
          </div>

          <div class="flex items-center justify-between p-4 bg-ink-900/40 rounded-xl border border-white/5">
            <div>
              <p class="text-sm font-medium text-white">إظهار دفتر الأوامر</p>
              <p class="text-[11px] text-slate-400">عرض أوامر الشراء والبيع النشطة</p>
            </div>
            <button
              onclick={() => (showOrderBook = !showOrderBook)}
              class="relative w-12 h-6 rounded-full transition-colors {showOrderBook ? 'bg-accent-gold' : 'bg-white/10'}"
            >
              <span class="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform {showOrderBook ? 'translate-x-0.5' : 'translate-x-6'}"></span>
            </button>
          </div>
        </div>
      </div>
    {:else if activeTab === 'currency'}
      <div class="space-y-6">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <Globe size={18} class="text-accent-gold" />
            <h2 class="text-base font-bold text-white">العملة والمنطقة</h2>
          </div>
          <p class="text-xs text-slate-400 mb-5">إعدادات العرض العملة والأسعار</p>
        </div>

        <!-- Display Currency -->
        <div>
          <label class="block text-sm font-semibold text-white mb-3">عملة العرض الأساسية</label>
          <div class="grid grid-cols-2 gap-3">
            {#each [['EGP', 'الجنيه المصري', 'ج.م'], ['USD', 'الدولار الأمريكي', '$']] as [val, label, sym]}
              <button
                onclick={() => (displayCurrency = val as any)}
                class="p-4 rounded-xl border-2 transition-all text-right {displayCurrency === val
                  ? 'border-accent-gold bg-accent-gold/5'
                  : 'border-white/5 bg-ink-900/40 hover:border-white/10'}"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm font-bold {displayCurrency === val ? 'text-accent-gold' : 'text-white'}">{label}</p>
                    <p class="text-[10px] text-slate-400 mt-0.5">{val}</p>
                  </div>
                  <span class="text-2xl font-bold text-slate-500">{sym}</span>
                </div>
              </button>
            {/each}
          </div>
        </div>

        <!-- Exchange Rate -->
        <div class="p-4 bg-ink-900/40 rounded-xl border border-white/5">
          <div class="flex items-center justify-between mb-3">
            <p class="text-sm font-medium text-white">سعر صرف USD → EGP</p>
            <button
              onclick={() => (autoUpdateRate = !autoUpdateRate)}
              class="relative w-11 h-5 rounded-full transition-colors {autoUpdateRate ? 'bg-accent-gold' : 'bg-white/10'}"
            >
              <span class="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform {autoUpdateRate ? 'translate-x-0.5' : 'translate-x-6'}"></span>
            </button>
          </div>
          <div class="flex items-center gap-2">
            <input
              type="number"
              bind:value={rate}
              step="0.01"
              min="0"
              disabled={autoUpdateRate}
              class="input flex-1 bg-ink-950/60 font-mono disabled:opacity-50"
            />
            <button
              onclick={() => usdEgpRate.setRate(rate)}
              disabled={autoUpdateRate}
              class="px-4 py-2 rounded-lg bg-accent-gold/15 text-accent-gold text-xs font-bold disabled:opacity-40"
            >
              تحديث
            </button>
          </div>
          <p class="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
            <Info size={10} />
            {autoUpdateRate ? 'يتم التحديث تلقائياً' : 'أدخل السعر يدوياً'}
          </p>
        </div>

        <!-- Language (placeholder) -->
        <div>
          <label class="block text-sm font-semibold text-white mb-3">اللغة</label>
          <div class="flex items-center gap-3 p-4 bg-ink-900/40 rounded-xl border border-white/5">
            <Languages size={18} class="text-accent-gold" />
            <div class="flex-1">
              <p class="text-sm font-medium text-white">العربية</p>
              <p class="text-[10px] text-slate-400">اللغة الحالية</p>
            </div>
            <span class="text-[10px] px-2 py-1 rounded bg-amber-500/10 text-amber-400">قريباً: English</span>
          </div>
        </div>
      </div>
    {:else if activeTab === 'security'}
      <div class="space-y-6">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <Shield size={18} class="text-accent-gold" />
            <h2 class="text-base font-bold text-white">الأمان والخصوصية</h2>
          </div>
          <p class="text-xs text-slate-400 mb-5">إعدادات حماية الحساب</p>
        </div>

        <a href="/dashboard/security" class="block p-4 bg-ink-900/40 rounded-xl border border-white/5 hover:border-accent-gold/30 transition-colors">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-accent-gold/10 flex items-center justify-center">
                <Lock size={18} class="text-accent-gold" />
              </div>
              <div>
                <p class="text-sm font-bold text-white">المصادقة الثنائية (2FA)</p>
                <p class="text-[11px] text-slate-400">إدارة إعدادات الحماية الثنائية وأجهزتك الموثوقة</p>
              </div>
            </div>
            <ChevronLeft size={18} class="text-slate-400" />
          </div>
        </a>

        <a href="/dashboard/kyc" class="block p-4 bg-ink-900/40 rounded-xl border border-white/5 hover:border-accent-gold/30 transition-colors">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-accent-violet/10 flex items-center justify-center">
                <FileText size={18} class="text-accent-violet" />
              </div>
              <div>
                <p class="text-sm font-bold text-white">التحقق من الهوية (KYC)</p>
                <p class="text-[11px] text-slate-400">رفع المستندات وإدارة حالة التحقق</p>
              </div>
            </div>
            <ChevronLeft size={18} class="text-slate-400" />
          </div>
        </a>

        <!-- Session timeout -->
        <div>
          <label class="block text-sm font-semibold text-white mb-3">انتهاء الجلسة التلقائي</label>
          <select class="input w-full bg-ink-900/60">
            <option value="15">15 دقيقة</option>
            <option value="30" selected>30 دقيقة</option>
            <option value="60">ساعة واحدة</option>
            <option value="240">4 ساعات</option>
            <option value="never">أبداً</option>
          </select>
          <p class="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
            <Info size={10} />
            يتم تسجيل الخروج تلقائياً بعد هذه المدة من عدم النشاط
          </p>
        </div>

        <!-- Login alerts -->
        <div class="flex items-center justify-between p-4 bg-ink-900/40 rounded-xl border border-white/5">
          <div>
            <p class="text-sm font-medium text-white">تنبيهات تسجيل الدخول</p>
            <p class="text-[11px] text-slate-400">إرسال إشعار عند تسجيل الدخول من جهاز جديد</p>
          </div>
          <button class="relative w-12 h-6 rounded-full bg-accent-gold">
            <span class="absolute top-0.5 w-5 h-5 rounded-full bg-white translate-x-0.5"></span>
          </button>
        </div>

        <!-- IP whitelist (info) -->
        <div class="flex items-center justify-between p-4 bg-ink-900/40 rounded-xl border border-white/5">
          <div>
            <p class="text-sm font-medium text-white">قائمة IP المسموح بها</p>
            <p class="text-[11px] text-slate-400">تقييد الدخول على عناوين IP معينة فقط</p>
          </div>
          <span class="text-[10px] px-2 py-1 rounded bg-amber-500/10 text-amber-400">يتطلب KYC</span>
        </div>
      </div>
    {/if}
  </div>
</div>
