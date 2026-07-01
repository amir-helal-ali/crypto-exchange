<script lang="ts">
        import { onMount } from 'svelte';
        import { authGet, authPut, authPost } from '$lib/api/client';
        import { toast } from '$lib/stores/toast';
        import PageHeader from '$lib/components/PageHeader.svelte';
        import Modal from '$lib/components/Modal.svelte';
        import ErrorAlert from '$lib/components/ErrorAlert.svelte';
        import type { SystemSettings, SSLStatus, MetricsData } from '$lib/api/types';
        import {
                Settings, Globe, Shield, Lock, RefreshCw, Save,
                CheckCircle, AlertTriangle, XCircle, Server, Wifi, Activity
        } from 'lucide-svelte';

        let settings = $state<SystemSettings | null>(null);
        let sslStatus = $state<SSLStatus | null>(null);
        let metrics = $state<MetricsData | null>(null);
        let loading = $state(true);
        let error = $state('');
        let activeTab = $state('overview');
        let saving = $state(false);

        let frontendDomain = $state('');
        let backendDomain = $state('');
        let adminDomain = $state('');
        let mainDomain = $state('');
        let sslEnabled = $state(false);
        let sslEmail = $state('');
        let sslType = $state('letsencrypt');
        let registrationOpen = $state(true);
        let maintenanceMode = $state(false);
        let maintenanceMessage = $state('');
        let corsOrigins = $state('');
        let sslModalOpen = $state(false);
        let sslModalLoading = $state(false);
        let certPem = $state('');
        let keyPem = $state('');

        // Computed health icon/color
        let sslHealthIcon = $derived(
                sslStatus?.health === 'healthy' ? CheckCircle :
                sslStatus?.health === 'warning' ? AlertTriangle : XCircle
        );
        let sslHealthColor = $derived(
                sslStatus?.health === 'healthy' ? 'text-accent-mint' :
                sslStatus?.health === 'warning' ? 'text-accent-gold' : 'text-accent-rose'
        );
        let sslHealthLabel = $derived(
                sslStatus?.health === 'healthy' ? 'سليم' :
                sslStatus?.health === 'warning' ? 'تحذير' : 'خطر'
        );

        const tabs = [
                { id: 'overview', label: 'نظرة عامة', icon: Settings },
                { id: 'domains', label: 'النطاقات', icon: Globe },
                { id: 'ssl', label: 'SSL', icon: Lock },
                { id: 'security', label: 'الأمان', icon: Shield },
                { id: 'features', label: 'الميزات', icon: Activity }
        ];

        async function loadSettings() {
                loading = true;
                error = '';
                const res = await authGet<SystemSettings>('/api/v1/admin/settings');
                if (res.success && res.data) {
                        settings = res.data;
                        frontendDomain = res.data.domains?.frontend_domain || '';
                        backendDomain = res.data.domains?.backend_domain || '';
                        adminDomain = res.data.domains?.admin_domain || '';
                        mainDomain = res.data.domains?.main_domain || '';
                        sslEnabled = res.data.ssl?.ssl_enabled === 'true';
                        corsOrigins = res.data.security?.cors_extra_origins || '';
                        registrationOpen = res.data.features?.registration_open !== 'false';
                        maintenanceMode = res.data.features?.maintenance_mode === 'true';
                        maintenanceMessage = res.data.features?.maintenance_message || '';
                } else {
                        error = res.error || 'فشل تحميل الإعدادات';
                }
                loadSSLStatus();
                loadMetrics();
                loading = false;
        }

        async function loadSSLStatus() {
                const res = await authGet<SSLStatus>('/api/v1/admin/ssl/status');
                if (res.success && res.data) sslStatus = res.data;
        }

        async function loadMetrics() {
                const res = await authGet<MetricsData>('/api/v1/admin/metrics');
                if (res.success && res.data) metrics = res.data;
        }

        async function saveSettings(keys: Record<string, string>) {
                saving = true;
                const res = await authPut('/api/v1/admin/settings', { settings: keys });
                if (res.success) {
                        toast.success('تم حفظ الإعدادات');
                        loadSettings();
                } else {
                        toast.error(res.error || 'فشل حفظ الإعدادات');
                }
                saving = false;
        }

        async function saveDomains() {
                await saveSettings({
                        frontend_domain: frontendDomain,
                        backend_domain: backendDomain,
                        admin_domain: adminDomain,
                        main_domain: mainDomain
                });
        }

        async function saveSSL() {
                await saveSettings({
                        ssl_enabled: String(sslEnabled),
                        ssl_cert_path: sslStatus?.cert_path || '',
                        ssl_key_path: sslStatus?.key_path || ''
                });
        }

        async function saveSecurity() {
                await saveSettings({ cors_extra_origins: corsOrigins });
        }

        async function saveFeatures() {
                await saveSettings({
                        registration_open: String(registrationOpen),
                        maintenance_mode: String(maintenanceMode),
                        maintenance_message: maintenanceMessage
                });
        }

        async function generateSSL() {
                sslModalLoading = true;
                const res = await authPost('/api/v1/admin/ssl/generate', {
                        type: sslType,
                        email: sslEmail,
                        domains: [mainDomain, adminDomain, frontendDomain].filter(Boolean)
                });
                if (res.success) {
                        toast.success('تم توليد شهادة SSL بنجاح');
                        loadSSLStatus();
                } else {
                        toast.error(res.error || 'فشل توليد شهادة SSL');
                }
                sslModalLoading = false;
        }

        async function renewSSL() {
                sslModalLoading = true;
                const res = await authPost('/api/v1/admin/ssl/renew');
                if (res.success) {
                        toast.success('تم تجديد شهادة SSL');
                        loadSSLStatus();
                } else {
                        toast.error(res.error || 'فشل تجديد شهادة SSL');
                }
                sslModalLoading = false;
        }

        async function installCustomSSL() {
                if (!certPem || !keyPem) { toast.error('يرجى إدخال الشهادة والمفتاح'); return; }
                sslModalLoading = true;
                const res = await authPost('/api/v1/admin/ssl/install', {
                        cert_pem: certPem,
                        key_pem: keyPem,
                        domains: [mainDomain].filter(Boolean)
                });
                if (res.success) {
                        toast.success('تم تثبيت الشهادة');
                        sslModalOpen = false;
                        loadSSLStatus();
                } else {
                        toast.error(res.error || 'فشل تثبيت الشهادة');
                }
                sslModalLoading = false;
        }

        async function reloadNginx() {
                const res = await authPost('/api/v1/admin/nginx/reload');
                if (res.success) {
                        toast.success('تم إعادة تحميل Nginx');
                } else {
                        toast.error(res.error || 'فشل إعادة تحميل Nginx');
                }
        }

        onMount(() => { loadSettings(); });
</script>

<PageHeader title="إعدادات النظام" subtitle="إدارة النطاقات والشهادات والميزات">
        <button class="btn-ghost" onclick={loadSettings} disabled={loading}>
                <RefreshCw size={16} class={loading ? 'animate-spin' : ''} />
        </button>
</PageHeader>

{#if error}
        <ErrorAlert message={error} onclose={() => (error = '')} />
{/if}

<!-- Tabs -->
<div class="flex items-center gap-1 mb-6 p-1 panel w-fit">
        {#each tabs as tab}
                <button
                        class="tab-btn {activeTab === tab.id ? 'tab-btn-active' : ''} flex items-center gap-2"
                        onclick={() => (activeTab = tab.id)}
                >
                        <tab.icon size={14} />
                        {tab.label}
                </button>
        {/each}
</div>

<!-- Tab: Overview -->
{#if activeTab === 'overview'}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="panel p-5">
                        <h3 class="text-base font-bold text-ink-primary mb-4 flex items-center gap-2">
                                <Server size={18} class="text-accent-violet" /> معلومات النظام
                        </h3>
                        {#if metrics}
                                <div class="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                                <span class="text-ink-muted block text-xs mb-1">Goroutines</span>
                                                <span class="text-ink-primary tabular-nums">{metrics.runtime.goroutines}</span>
                                        </div>
                                        <div>
                                                <span class="text-ink-muted block text-xs mb-1">Heap Alloc</span>
                                                <span class="text-ink-primary tabular-nums">{metrics.runtime.heap_alloc_mb.toFixed(1)} MB</span>
                                        </div>
                                        <div>
                                                <span class="text-ink-muted block text-xs mb-1">Heap In Use</span>
                                                <span class="text-ink-primary tabular-nums">{metrics.runtime.heap_in_use_mb.toFixed(1)} MB</span>
                                        </div>
                                        <div>
                                                <span class="text-ink-muted block text-xs mb-1">GC Count</span>
                                                <span class="text-ink-primary tabular-nums">{metrics.runtime.num_gc}</span>
                                        </div>
                                        <div>
                                                <span class="text-ink-muted block text-xs mb-1">Go Version</span>
                                                <span class="text-ink-primary">{metrics.runtime.go_version}</span>
                                        </div>
                                        <div>
                                                <span class="text-ink-muted block text-xs mb-1">CPU Cores</span>
                                                <span class="text-ink-primary tabular-nums">{metrics.runtime.num_cpu}</span>
                                        </div>
                                </div>
                        {:else}
                                <div class="skeleton h-32"></div>
                        {/if}
                </div>

                <div class="panel p-5">
                        <h3 class="text-base font-bold text-ink-primary mb-4 flex items-center gap-2">
                                <Wifi size={18} class="text-accent-azure" /> الاتصالات
                        </h3>
                        {#if metrics}
                                <div class="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                                <span class="text-ink-muted block text-xs mb-1">Market Clients</span>
                                                <span class="text-ink-primary tabular-nums">{metrics.websocket.market_clients}</span>
                                        </div>
                                        <div>
                                                <span class="text-ink-muted block text-xs mb-1">User Clients</span>
                                                <span class="text-ink-primary tabular-nums">{metrics.websocket.user_clients}</span>
                                        </div>
                                        <div>
                                                <span class="text-ink-muted block text-xs mb-1">Online Users</span>
                                                <span class="text-ink-primary tabular-nums">{metrics.websocket.online_users}</span>
                                        </div>
                                        <div>
                                                <span class="text-ink-muted block text-xs mb-1">SSE Subscribers</span>
                                                <span class="text-ink-primary tabular-nums">{metrics.sse.admin_subscribers}</span>
                                        </div>
                                        <div>
                                                <span class="text-ink-muted block text-xs mb-1">Binance</span>
                                                <span class={metrics.upstream.binance_connected ? 'text-accent-mint' : 'text-accent-rose'}>
                                                        {metrics.upstream.binance_connected ? 'متصل' : 'غير متصل'}
                                                </span>
                                        </div>
                                        <div>
                                                <span class="text-ink-muted block text-xs mb-1">Binance Symbols</span>
                                                <span class="text-ink-primary tabular-nums">{metrics.upstream.binance_symbols}</span>
                                        </div>
                                </div>
                        {:else}
                                <div class="skeleton h-32"></div>
                        {/if}
                </div>

                <div class="panel p-5">
                        <h3 class="text-base font-bold text-ink-primary mb-4 flex items-center gap-2">
                                <Lock size={18} class="text-accent-gold" /> حالة SSL
                        </h3>
                        {#if sslStatus}
                                <div class="flex items-center gap-3 mb-4">
                                        {#if sslStatus.health === 'healthy'}
                                                <CheckCircle size={20} class="text-accent-mint" />
                                        {:else if sslStatus.health === 'warning'}
                                                <AlertTriangle size={20} class="text-accent-gold" />
                                        {:else}
                                                <XCircle size={20} class="text-accent-rose" />
                                        {/if}
                                        <div>
                                                <p class="text-sm font-bold {sslHealthColor}">{sslHealthLabel}</p>
                                                <p class="text-xs text-ink-muted">{sslStatus.enabled ? 'مفعّل' : 'معطّل'}</p>
                                        </div>
                                </div>
                                {#if sslStatus.days_remaining != null}
                                        <div class="text-sm text-ink-secondary mb-2">
                                                الأيام المتبقية: <span class="tabular-nums font-bold {sslStatus.days_remaining < 30 ? 'text-accent-rose' : 'text-accent-mint'}">{sslStatus.days_remaining}</span>
                                        </div>
                                {/if}
                                {#if sslStatus.issuer_org}
                                        <div class="text-xs text-ink-muted">الجهة المصدرة: {sslStatus.issuer_org}</div>
                                {/if}
                        {:else}
                                <div class="skeleton h-24"></div>
                        {/if}
                </div>

                <div class="panel p-5">
                        <h3 class="text-base font-bold text-ink-primary mb-4">إجراءات سريعة</h3>
                        <div class="flex flex-col gap-2">
                                <button class="btn-secondary w-full justify-start" onclick={reloadNginx}>
                                        <RefreshCw size={16} /> إعادة تحميل Nginx
                                </button>
                                <button class="btn-secondary w-full justify-start" onclick={() => (activeTab = 'ssl')}>
                                        <Lock size={16} /> إدارة SSL
                                </button>
                                <button class="btn-secondary w-full justify-start" onclick={() => (activeTab = 'domains')}>
                                        <Globe size={16} /> إدارة النطاقات
                                </button>
                        </div>
                </div>
        </div>
{/if}

<!-- Tab: Domains -->
{#if activeTab === 'domains'}
        <div class="panel p-6 max-w-2xl">
                <h3 class="text-base font-bold text-ink-primary mb-6 flex items-center gap-2">
                        <Globe size={18} class="text-accent-gold" /> إعدادات النطاقات
                </h3>
                <form onsubmit={(e) => { e.preventDefault(); saveDomains(); }} class="flex flex-col gap-5">
                        <div>
                                <label for="mainDomain" class="block text-sm font-medium text-ink-secondary mb-2">النطاق الرئيسي</label>
                                <input id="mainDomain" type="text" bind:value={mainDomain} class="input-field" placeholder="example.com" dir="ltr" />
                        </div>
                        <div>
                                <label for="frontendDomain" class="block text-sm font-medium text-ink-secondary mb-2">نطاق الواجهة</label>
                                <input id="frontendDomain" type="text" bind:value={frontendDomain} class="input-field" placeholder="www.example.com" dir="ltr" />
                        </div>
                        <div>
                                <label for="backendDomain" class="block text-sm font-medium text-ink-secondary mb-2">نطاق API</label>
                                <input id="backendDomain" type="text" bind:value={backendDomain} class="input-field" placeholder="api.example.com" dir="ltr" />
                        </div>
                        <div>
                                <label for="adminDomain" class="block text-sm font-medium text-ink-secondary mb-2">نطاق لوحة الإدارة</label>
                                <input id="adminDomain" type="text" bind:value={adminDomain} class="input-field" placeholder="admin.example.com" dir="ltr" />
                        </div>
                        <div class="flex items-center gap-3 pt-2">
                                <button type="submit" class="btn-primary" disabled={saving}>
                                        {#if saving}<RefreshCw size={14} class="animate-spin" />{:else}<Save size={14} />{/if}
                                        حفظ النطاقات
                                </button>
                                <button type="button" class="btn-secondary" onclick={reloadNginx}>
                                        <RefreshCw size={14} /> إعادة تحميل Nginx
                                </button>
                        </div>
                </form>
        </div>
{/if}

<!-- Tab: SSL -->
{#if activeTab === 'ssl'}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="panel p-6">
                        <h3 class="text-base font-bold text-ink-primary mb-6 flex items-center gap-2">
                                <Lock size={18} class="text-accent-gold" /> إعدادات SSL
                        </h3>
                        <div class="flex flex-col gap-5">
                                <div class="flex items-center gap-3">
                                        <button
                                                type="button"
                                                onclick={() => (sslEnabled = !sslEnabled)}
                                                class="toggle-track {sslEnabled ? 'toggle-track-active' : ''}"
                                                aria-label="تفعيل SSL"
                                        >
                                                <div class="toggle-thumb {sslEnabled ? 'toggle-thumb-active right-1' : 'right-[22px]'}"></div>
                                        </button>
                                        <span class="text-sm text-ink-secondary">{sslEnabled ? 'SSL مفعّل' : 'SSL معطّل'}</span>
                                </div>
                                <div>
                                        <label for="sslType" class="block text-sm font-medium text-ink-secondary mb-2">نوع الشهادة</label>
                                        <select id="sslType" bind:value={sslType} class="input-field">
                                                <option value="letsencrypt">Let's Encrypt</option>
                                                <option value="local">محلي (Self-signed)</option>
                                                <option value="custom">مخصص</option>
                                        </select>
                                </div>
                                {#if sslType === 'letsencrypt'}
                                        <div>
                                                <label for="sslEmail" class="block text-sm font-medium text-ink-secondary mb-2">البريد الإلكتروني</label>
                                                <input id="sslEmail" type="email" bind:value={sslEmail} class="input-field" placeholder="admin@example.com" dir="ltr" />
                                        </div>
                                {/if}
                                <div class="flex items-center gap-3 pt-2">
                                        <button class="btn-primary" onclick={() => {
                                                if (sslType === 'custom') { sslModalOpen = true; }
                                                else { generateSSL(); }
                                        }} disabled={sslModalLoading}>
                                                {#if sslModalLoading}<RefreshCw size={14} class="animate-spin" />{:else}<Lock size={14} />{/if}
                                                {sslType === 'custom' ? 'تثبيت شهادة' : 'توليد شهادة'}
                                        </button>
                                        {#if sslStatus?.type === 'letsencrypt'}
                                                <button class="btn-secondary" onclick={renewSSL} disabled={sslModalLoading}>
                                                        <RefreshCw size={14} /> تجديد
                                                </button>
                                        {/if}
                                        <button class="btn-secondary" onclick={saveSSL} disabled={saving}>
                                                <Save size={14} /> حفظ الإعدادات
                                        </button>
                                </div>
                        </div>
                </div>

                <div class="panel p-6">
                        <h3 class="text-base font-bold text-ink-primary mb-6">حالة الشهادة</h3>
                        {#if sslStatus}
                                <div class="flex flex-col gap-4 text-sm">
                                        <div class="flex items-center gap-2">
                                                {#if sslStatus.health === 'healthy'}
                                                        <CheckCircle size={18} class="text-accent-mint" />
                                                {:else if sslStatus.health === 'warning'}
                                                        <AlertTriangle size={18} class="text-accent-gold" />
                                                {:else}
                                                        <XCircle size={18} class="text-accent-rose" />
                                                {/if}
                                                <span class="font-bold {sslHealthColor}">{sslHealthLabel}</span>
                                        </div>
                                        {#if sslStatus.subject}
                                                <div><span class="text-ink-muted">الموضوع:</span> <span class="text-ink-primary" dir="ltr">{sslStatus.subject}</span></div>
                                        {/if}
                                        {#if sslStatus.issuer_org}
                                                <div><span class="text-ink-muted">الجهة المصدرة:</span> <span class="text-ink-primary">{sslStatus.issuer_org}</span></div>
                                        {/if}
                                        {#if sslStatus.not_before}
                                                <div><span class="text-ink-muted">تاريخ الإصدار:</span> <span class="text-ink-primary">{sslStatus.not_before}</span></div>
                                        {/if}
                                        {#if sslStatus.not_after}
                                                <div><span class="text-ink-muted">تاريخ الانتهاء:</span> <span class="text-ink-primary">{sslStatus.not_after}</span></div>
                                        {/if}
                                        {#if sslStatus.days_remaining != null}
                                                <div>
                                                        <span class="text-ink-muted">الأيام المتبقية:</span>
                                                        <span class="tabular-nums font-bold {sslStatus.days_remaining < 30 ? 'text-accent-rose' : 'text-accent-mint'}">{sslStatus.days_remaining}</span>
                                                </div>
                                        {/if}
                                        {#if sslStatus.sans?.length}
                                                <div>
                                                        <span class="text-ink-muted block mb-1">النطاقات المشمولة (SANs):</span>
                                                        <div class="flex flex-wrap gap-1">
                                                                {#each sslStatus.sans as san}
                                                                        <span class="pill-pending text-[10px]" dir="ltr">{san}</span>
                                                                {/each}
                                                        </div>
                                                </div>
                                        {/if}
                                </div>
                        {:else}
                                <div class="skeleton h-48"></div>
                        {/if}
                </div>
        </div>
{/if}

<!-- Tab: Security -->
{#if activeTab === 'security'}
        <div class="panel p-6 max-w-2xl">
                <h3 class="text-base font-bold text-ink-primary mb-6 flex items-center gap-2">
                        <Shield size={18} class="text-accent-azure" /> إعدادات الأمان
                </h3>
                <form onsubmit={(e) => { e.preventDefault(); saveSecurity(); }} class="flex flex-col gap-5">
                        <div>
                                <label for="corsOrigins" class="block text-sm font-medium text-ink-secondary mb-2">أصول CORS إضافية</label>
                                <textarea id="corsOrigins" bind:value={corsOrigins} class="input-field min-h-[100px] font-mono text-xs" placeholder="https://example.com, https://admin.example.com" dir="ltr"></textarea>
                                <p class="text-xs text-ink-muted mt-1">افصل بين النطاقات بفواصل</p>
                        </div>
                        <button type="submit" class="btn-primary w-fit" disabled={saving}>
                                {#if saving}<RefreshCw size={14} class="animate-spin" />{:else}<Save size={14} />{/if}
                                حفظ
                        </button>
                </form>
        </div>
{/if}

<!-- Tab: Features -->
{#if activeTab === 'features'}
        <div class="panel p-6 max-w-2xl">
                <h3 class="text-base font-bold text-ink-primary mb-6 flex items-center gap-2">
                        <Activity size={18} class="text-accent-mint" /> ميزات النظام
                </h3>
                <form onsubmit={(e) => { e.preventDefault(); saveFeatures(); }} class="flex flex-col gap-6">
                        <div class="flex items-center justify-between">
                                <div>
                                        <p class="text-sm font-medium text-ink-primary">التسجيل المفتوح</p>
                                        <p class="text-xs text-ink-muted">السماح للمستخدمين الجدد بالتسجيل</p>
                                </div>
                                <button type="button" onclick={() => (registrationOpen = !registrationOpen)} class="toggle-track {registrationOpen ? 'toggle-track-active' : ''}" aria-label="تفعيل التسجيل">
                                        <div class="toggle-thumb {registrationOpen ? 'toggle-thumb-active right-1' : 'right-[22px]'}"></div>
                                </button>
                        </div>
                        <div class="glass-divider"></div>
                        <div class="flex items-center justify-between">
                                <div>
                                        <p class="text-sm font-medium text-ink-primary">وضع الصيانة</p>
                                        <p class="text-xs text-ink-muted">تعطيل الواجهة للمستخدمين مع عرض رسالة صيانة</p>
                                </div>
                                <button type="button" onclick={() => (maintenanceMode = !maintenanceMode)} class="toggle-track {maintenanceMode ? 'toggle-track-active' : ''}" aria-label="وضع الصيانة">
                                        <div class="toggle-thumb {maintenanceMode ? 'toggle-thumb-active right-1' : 'right-[22px]'}"></div>
                                </button>
                        </div>
                        {#if maintenanceMode}
                                <div>
                                        <label for="maintenanceMsg" class="block text-sm font-medium text-ink-secondary mb-2">رسالة الصيانة</label>
                                        <textarea id="maintenanceMsg" bind:value={maintenanceMessage} class="input-field min-h-[80px]" placeholder="الموقع تحت الصيانة، سنعود قريباً..."></textarea>
                                </div>
                        {/if}
                        <div class="glass-divider"></div>
                        <button type="submit" class="btn-primary w-fit" disabled={saving}>
                                {#if saving}<RefreshCw size={14} class="animate-spin" />{:else}<Save size={14} />{/if}
                                حفظ الميزات
                        </button>
                </form>
        </div>
{/if}

<!-- Custom SSL Install Modal -->
<Modal bind:open={sslModalOpen} title="تثبيت شهادة SSL مخصصة" icon={Lock} size="lg">
        <div class="flex flex-col gap-4">
                <div>
                        <label for="certPem" class="block text-sm font-medium text-ink-secondary mb-2">شهادة PEM</label>
                        <textarea id="certPem" bind:value={certPem} class="input-field min-h-[120px] font-mono text-xs" placeholder="-----BEGIN CERTIFICATE-----..." dir="ltr"></textarea>
                </div>
                <div>
                        <label for="keyPem" class="block text-sm font-medium text-ink-secondary mb-2">مفتاح PEM</label>
                        <textarea id="keyPem" bind:value={keyPem} class="input-field min-h-[120px] font-mono text-xs" placeholder="-----BEGIN PRIVATE KEY-----..." dir="ltr"></textarea>
                </div>
        </div>
        {#snippet footer()}
                <button class="btn-ghost" onclick={() => (sslModalOpen = false)}>إلغاء</button>
                <button class="btn-primary" onclick={installCustomSSL} disabled={sslModalLoading || !certPem || !keyPem}>
                        {#if sslModalLoading}<RefreshCw size={14} class="animate-spin" />{/if}
                        تثبيت
                </button>
        {/snippet}
</Modal>
